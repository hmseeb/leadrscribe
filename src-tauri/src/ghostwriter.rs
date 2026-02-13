use anyhow::Result;
use log::{debug, error};
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

    // Build structured system prompt with XML tags to prevent AI hallucinations
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

    // Build user message with XML-wrapped transcription (prevents prompt injection)
    let user_message = format!("<transcription>\n{}\n</transcription>", original_text);

    // Calculate smart max_tokens: allow up to 2x the original length plus buffer
    // This prevents unnecessary generation while allowing for expansions
    let max_tokens = (original_text.len() * 2 + 100).min(4000);

    // Build the request
    let request_body = OpenRouterRequest {
        model: model.to_string(),
        messages: vec![
            Message {
                role: "system".to_string(),
                content: system_prompt,
            },
            Message {
                role: "user".to_string(),
                content: user_message,
            },
        ],
        max_tokens: Some(max_tokens),
        stream: None, // Non-streaming
    };

    // Make the API call using the reusable client
    let response = HTTP_CLIENT
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://leadrscribe.vercel.app")
        .header("X-Title", "LeadrScribe")
        .json(&request_body)
        .send()
        .await?;

    // Check response status
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        error!(
            "OpenRouter API returned error status {}: {}",
            status, error_text
        );

        // Provide user-friendly error messages based on status code
        let user_message = match status.as_u16() {
            401 => "Invalid OpenRouter API key. Please check your API key in Settings → OpenRouter API Key.".to_string(),
            402 => "Insufficient OpenRouter credits. Please add credits to your account at openrouter.ai.".to_string(),
            403 => "Access forbidden. Please check your OpenRouter API key permissions.".to_string(),
            404 => format!("Model '{}' not found. Please select a valid model in settings.", model),
            429 => "OpenRouter rate limit exceeded. Please wait a moment and try again.".to_string(),
            500..=599 => "OpenRouter service error. Please try again later.".to_string(),
            _ => "OpenRouter API request failed. Please check your settings and try again.".to_string(),
        };

        return Err(anyhow::anyhow!("{}", user_message));
    }

    // Parse response
    let response_body: OpenRouterResponse = response.json().await
        .map_err(|e| anyhow::anyhow!("Failed to parse API response: {}", e))?;

    let message = &response_body
        .choices
        .first()
        .ok_or_else(|| anyhow::anyhow!("No choices in OpenRouter response"))?
        .message;

    // Try content first, then reasoning field (for reasoning models)
    let raw_text = if !message.content.trim().is_empty() {
        message.content.trim()
    } else if let Some(reasoning) = &message.reasoning {
        reasoning.trim()
    } else {
        message.content.trim() // Fallback to content even if empty
    };

    // Strip any preambles that might have slipped through
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
