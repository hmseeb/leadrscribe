use anyhow::Result;
use log::{debug, error, warn};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::time::Duration;

// Reusable HTTP client with connection pooling for better performance
static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .pool_max_idle_per_host(5)
        .build()
        .expect("Failed to build HTTP client")
});

#[derive(Serialize)]
struct OpenRouterRequest {
    model: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct OpenRouterResponse {
    choices: Vec<Choice>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

// Response message that can contain either content or reasoning
#[derive(Deserialize)]
struct ResponseMessage {
    #[allow(dead_code)]
    role: String,
    content: String,
    reasoning: Option<String>,
}

/// Process transcribed text through OpenRouter API for ghostwriting (non-streaming)
///
/// # Arguments
/// * `original_text` - The transcribed text from speech-to-text
/// * `api_key` - OpenRouter API key (if None, returns original text)
/// * `model` - Model identifier (e.g., "anthropic/claude-3.5-sonnet")
/// * `custom_instructions` - System prompt for how to rewrite the text
///
/// # Returns
/// * `Ok(String)` - The ghostwritten text
/// * `Err(anyhow::Error)` - If API call fails (caller should fallback to original)
pub async fn process_text(
    original_text: &str,
    api_key: &Option<String>,
    model: &str,
    custom_instructions: &str,
) -> Result<String> {
    let start_time = std::time::Instant::now();

    // If no API key, return specific error
    let api_key = match api_key {
        Some(key) if !key.is_empty() => key,
        _ => {
            debug!("No OpenRouter API key configured, skipping ghostwriting");
            return Err(anyhow::anyhow!("No API key configured. Please add your OpenRouter API key in settings."));
        }
    };

    debug!(
        "Starting ghostwriting with model: {} (text length: {} chars)",
        model,
        original_text.len()
    );

    let system_prompt = format!(
        r#"You are a transcription rewriter. Your ONLY job is to rewrite the transcribed speech provided to you.

CRITICAL RULES:
1. Output ONLY the rewritten transcription
2. DO NOT add any preambles, introductions, or explanations
3. DO NOT add phrases like "Here's the rewritten version:" or "Here is:"
4. DO NOT ask questions or seek clarification
5. If the transcription is unclear, do your best to improve it anyway
6. Output should START with the first word of the rewritten content
7. Output should END with the last word of the rewritten content

<rewriting_instructions>
{}
</rewriting_instructions>

Now rewrite the transcription found in the <transcription> tags below. Remember: output ONLY the rewritten text, nothing else."#,
        custom_instructions
    );

    let user_message = format!("<transcription>\n{}\n</transcription>", original_text);
    let max_tokens = (original_text.len() * 2 + 100).min(4000);

    // Try with system message first, retry without if model doesn't support it
    let response = send_openrouter_request(api_key, model, &system_prompt, &user_message, max_tokens).await?;

    // Check if model doesn't support system messages — retry with instructions folded into user message
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        error!("OpenRouter API error {}: {}", status, error_text);

        if is_system_message_error(&error_text) {
            warn!("Model '{}' doesn't support system messages, retrying with instructions in user message", model);
            let combined_user = format!("{}\n\n{}", system_prompt, user_message);
            let retry_response = send_openrouter_request(api_key, model, "", &combined_user, max_tokens).await?;

            if !retry_response.status().is_success() {
                let retry_status = retry_response.status();
                let retry_error = retry_response.text().await.unwrap_or_default();
                error!("OpenRouter retry failed {}: {}", retry_status, retry_error);
                return Err(anyhow::anyhow!("{}", parse_openrouter_error(retry_status.as_u16(), &retry_error, model)));
            }

            return parse_openrouter_success(retry_response, original_text, start_time).await;
        }

        return Err(anyhow::anyhow!("{}", parse_openrouter_error(status.as_u16(), &error_text, model)));
    }

    parse_openrouter_success(response, original_text, start_time).await
}

/// Send a request to OpenRouter. If system_prompt is empty, only sends user message.
async fn send_openrouter_request(
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_message: &str,
    max_tokens: usize,
) -> Result<reqwest::Response> {
    let mut messages = Vec::new();
    if !system_prompt.is_empty() {
        messages.push(Message { role: "system".to_string(), content: system_prompt.to_string() });
    }
    messages.push(Message { role: "user".to_string(), content: user_message.to_string() });

    let request_body = OpenRouterRequest {
        model: model.to_string(),
        messages,
        max_tokens: Some(max_tokens),
        stream: None,
    };

    HTTP_CLIENT
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://leadrscribe.vercel.app")
        .header("X-Title", "LeadrScribe")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Network error: {}", e))
}

/// Parse a successful OpenRouter response into ghostwritten text.
async fn parse_openrouter_success(
    response: reqwest::Response,
    original_text: &str,
    start_time: std::time::Instant,
) -> Result<String> {
    let response_body: OpenRouterResponse = response.json().await
        .map_err(|e| anyhow::anyhow!("Failed to parse API response: {}", e))?;

    let message = &response_body
        .choices
        .first()
        .ok_or_else(|| anyhow::anyhow!("No response from model. Try a different model."))?
        .message;

    let raw_text = if !message.content.trim().is_empty() {
        message.content.trim()
    } else if let Some(reasoning) = &message.reasoning {
        reasoning.trim()
    } else {
        message.content.trim()
    };

    let ghostwritten_text = strip_preambles(raw_text);

    let elapsed = start_time.elapsed();
    debug!(
        "Ghostwriting completed in {}ms (original: {} chars, rewritten: {} chars)",
        elapsed.as_millis(),
        original_text.len(),
        ghostwritten_text.len()
    );

    Ok(ghostwritten_text)
}

/// Check if an OpenRouter error indicates system/developer messages aren't supported.
fn is_system_message_error(error_text: &str) -> bool {
    let lower = error_text.to_lowercase();
    lower.contains("developer instruction is not enabled")
        || lower.contains("system message is not supported")
        || lower.contains("does not support system")
}

/// Parse OpenRouter error JSON into a human-readable message.
/// OpenRouter format: {"error":{"message":"...","code":400,"metadata":{"raw":"<json-string>","provider_name":"..."}}}
fn parse_openrouter_error(status: u16, error_text: &str, model: &str) -> String {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(error_text) {
        if let Some(error_obj) = json.get("error") {
            let provider = error_obj
                .pointer("/metadata/provider_name")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            // Try to extract inner message from metadata.raw (can be a JSON string or object)
            let inner_msg = error_obj.pointer("/metadata/raw").and_then(|raw_value| {
                // If raw is a string containing JSON, parse it
                let raw_json = if let Some(raw_str) = raw_value.as_str() {
                    serde_json::from_str::<serde_json::Value>(raw_str).ok()
                } else if raw_value.is_object() {
                    Some(raw_value.clone())
                } else {
                    None
                };

                raw_json.and_then(|rj| {
                    // Try common paths: /error/message, /message, /error
                    rj.pointer("/error/message")
                        .or_else(|| rj.get("message"))
                        .or_else(|| rj.get("error").filter(|v| v.is_string()))
                        .and_then(|v| v.as_str().map(String::from))
                })
            });

            if let Some(msg) = inner_msg {
                return if provider.is_empty() {
                    msg
                } else {
                    format!("{}: {}", provider, msg)
                };
            }

            // Fall back to top-level error.message (skip if it's just "Provider returned error")
            if let Some(msg) = error_obj.get("message").and_then(|v| v.as_str()) {
                if msg != "Provider returned error" {
                    return if provider.is_empty() {
                        msg.to_string()
                    } else {
                        format!("{}: {}", provider, msg)
                    };
                }
            }

            // If we have a provider but no useful message, say so
            if !provider.is_empty() {
                return match status {
                    401 => format!("{} rejected the API key.", provider),
                    402 => format!("{}: insufficient credits.", provider),
                    429 => format!("{}: rate limit exceeded. Try again shortly.", provider),
                    _ => format!("{} returned an error ({}). Try a different model.", provider, status),
                };
            }
        }
    }

    // Fallback for non-JSON or unparseable errors
    match status {
        401 => "Invalid API key. Check your OpenRouter API key in Settings.".to_string(),
        402 => "Insufficient credits. Add credits at openrouter.ai.".to_string(),
        403 => "Access forbidden. Check your API key permissions.".to_string(),
        404 => format!("Model '{}' not found on OpenRouter.", model),
        429 => "Rate limit exceeded. Wait a moment and try again.".to_string(),
        500..=599 => "OpenRouter service error. Try again later.".to_string(),
        _ => format!("OpenRouter error ({}). Try a different model.", status),
    }
}

/// Strip common preambles that AI models might add despite instructions
///
/// This is a safety net that removes phrases like "Here's the rewritten version:",
/// "Here is:", etc. that might slip through even with structured prompting.
fn strip_preambles(text: &str) -> String {
    let preambles = [
        "Here's the rewritten version:",
        "Here's a rewritten version:",
        "Here's the polished version:",
        "Here's a polished version:",
        "Here's the revised version:",
        "Here's a revised version:",
        "Here is the rewritten version:",
        "Here is a rewritten version:",
        "Here is the polished version:",
        "Here is a polished version:",
        "Here is the revised version:",
        "Here is a revised version:",
        "Here is:",
        "Here's:",
        "Rewritten version:",
        "Polished version:",
        "Revised version:",
    ];

    let mut result = text.trim().to_string();

    // Try to strip any matching preamble (case-insensitive)
    for preamble in &preambles {
        let preamble_lower = preamble.to_lowercase();
        let result_lower = result.to_lowercase();

        if result_lower.starts_with(&preamble_lower) {
            // Remove the preamble and any following whitespace/newlines/quotes
            result = result[preamble.len()..].trim_start().to_string();

            // Remove leading quotes that might be left over
            if result.starts_with('"') || result.starts_with('\'') {
                result = result[1..].to_string();
            }

            // Remove trailing quotes that might have been added
            if result.ends_with('"') || result.ends_with('\'') {
                result = result[..result.len() - 1].to_string();
            }

            break;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_no_api_key_returns_original() {
        let result = process_text(
            "test text",
            &None,
            "anthropic/claude-3.5-sonnet",
            "Improve this",
        )
        .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err().to_string(), "No API key configured. Please add your OpenRouter API key in settings.");
    }

    #[tokio::test]
    async fn test_empty_api_key_returns_original() {
        let result = process_text(
            "test text",
            &Some("".to_string()),
            "anthropic/claude-3.5-sonnet",
            "Improve this",
        )
        .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err().to_string(), "No API key configured. Please add your OpenRouter API key in settings.");
    }

    #[test]
    fn test_strip_preambles_basic() {
        let input = "Here's the rewritten version: Hello, I'm testing this feature.";
        let expected = "Hello, I'm testing this feature.";
        assert_eq!(strip_preambles(input), expected);
    }

    #[test]
    fn test_strip_preambles_polished() {
        let input = "Here's a polished version: This is the actual content.";
        let expected = "This is the actual content.";
        assert_eq!(strip_preambles(input), expected);
    }

    #[test]
    fn test_strip_preambles_with_quotes() {
        let input = "Here is: \"The quoted content here\"";
        let expected = "The quoted content here";
        assert_eq!(strip_preambles(input), expected);
    }

    #[test]
    fn test_strip_preambles_no_preamble() {
        let input = "This is just normal text without any preamble.";
        assert_eq!(strip_preambles(input), input);
    }

    #[test]
    fn test_strip_preambles_case_insensitive() {
        let input = "HERE'S THE REWRITTEN VERSION: Content here.";
        let expected = "Content here.";
        assert_eq!(strip_preambles(input), expected);
    }
}
