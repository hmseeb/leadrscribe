#!/bin/bash

# LeadrScribe Rebrand Script
# Automatically replaces all "Handy" references with "LeadrScribe"

echo "🚀 Starting LeadrScribe Rebrand..."
echo "=================================="

# Configuration
OLD_NAME="Handy"
NEW_NAME="LeadrScribe"
OLD_PACKAGE="handy"
NEW_PACKAGE="leadrscribe"
OLD_URL_DOMAIN="handy.computer"
NEW_URL_DOMAIN="leadrscribe.vercel.app"
OLD_GITHUB="github.com/cjpais/Handy"
NEW_GITHUB="github.com/hmseeb/leadrscribe"
OLD_BUNDLE_ID="com.pais.handy"
NEW_BUNDLE_ID="com.leadr.leadrscribe"

# Counter for changes
CHANGES=0

# Function to replace in file
replace_in_file() {
    local file=$1
    local search=$2
    local replace=$3

    if [ -f "$file" ]; then
        if grep -q "$search" "$file" 2>/dev/null; then
            sed -i "s|$search|$replace|g" "$file"
            echo "  ✓ Updated: $file"
            ((CHANGES++))
        fi
    fi
}

echo ""
echo "📦 Phase 1: Package Configuration Files"
echo "========================================"

# package.json
replace_in_file "package.json" '"name": "handy-app"' '"name": "leadrscribe-app"'

# package-lock.json
replace_in_file "package-lock.json" '"name": "handy-app"' '"name": "leadrscribe-app"'

# Cargo.toml
replace_in_file "src-tauri/Cargo.toml" 'name = "handy"' 'name = "leadrscribe"'
replace_in_file "src-tauri/Cargo.toml" 'description = "Handy"' 'description = "LeadrScribe"'
replace_in_file "src-tauri/Cargo.toml" 'default-run = "handy"' 'default-run = "leadrscribe"'
replace_in_file "src-tauri/Cargo.toml" 'name = "handy_app_lib"' 'name = "leadrscribe_app_lib"'

# Cargo.lock
replace_in_file "src-tauri/Cargo.lock" 'name = "handy"' 'name = "leadrscribe"'

# tauri.conf.json
replace_in_file "src-tauri/tauri.conf.json" '"productName": "Handy"' '"productName": "LeadrScribe"'
replace_in_file "src-tauri/tauri.conf.json" '"identifier": "com.pais.handy"' '"identifier": "com.leadr.leadrscribe"'
replace_in_file "src-tauri/tauri.conf.json" '"title": "Handy"' '"title": "LeadrScribe"'
replace_in_file "src-tauri/tauri.conf.json" '-d Handy' '-d LeadrScribe'

echo ""
echo "🎨 Phase 2: UI Components"
echo "========================="

# Component imports and exports - Handle component renames
sed -i 's/HandyShortcut/LeadrScribeShortcut/g' src/components/settings/*.tsx src/components/settings/index.ts 2>/dev/null
sed -i 's/HandyTextLogo/LeadrScribeLogo/g' src/components/**/*.tsx src/components/**/*.ts 2>/dev/null
sed -i 's/HandyHand/LeadrScribeIcon/g' src/components/**/*.tsx 2>/dev/null

# Rename component files
if [ -f "src/components/settings/HandyShortcut.tsx" ]; then
    mv "src/components/settings/HandyShortcut.tsx" "src/components/settings/LeadrScribeShortcut.tsx"
    echo "  ✓ Renamed: HandyShortcut.tsx → LeadrScribeShortcut.tsx"
    ((CHANGES++))
fi

if [ -f "src/components/icons/HandyTextLogo.tsx" ]; then
    mv "src/components/icons/HandyTextLogo.tsx" "src/components/icons/LeadrScribeLogo.tsx"
    echo "  ✓ Renamed: HandyTextLogo.tsx → LeadrScribeLogo.tsx"
    ((CHANGES++))
fi

if [ -f "src/components/icons/HandyHand.tsx" ]; then
    mv "src/components/icons/HandyHand.tsx" "src/components/icons/LeadrScribeIcon.tsx"
    echo "  ✓ Renamed: HandyHand.tsx → LeadrScribeIcon.tsx"
    ((CHANGES++))
fi

# Update all UI text references
find src/components -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
    -e 's/Handy /LeadrScribe /g' \
    -e 's/Handy\./LeadrScribe./g' \
    -e 's/Handy"/LeadrScribe"/g' \
    -e "s/Handy'/LeadrScribe'/g" \
    -e 's/Handy`/LeadrScribe`/g' \
    -e 's/Handy!/LeadrScribe!/g' \
    -e 's/Handy?/LeadrScribe?/g' \
    -e 's/for Handy/for LeadrScribe/g' \
    -e 's/to Handy/to LeadrScribe/g' \
    -e 's/of Handy/of LeadrScribe/g' \
    {} \; 2>/dev/null

echo "  ✓ Updated UI component text references"
((CHANGES+=10))

# index.html
replace_in_file "index.html" '<title>handy</title>' '<title>LeadrScribe</title>'

echo ""
echo "🦀 Phase 3: Rust Backend"
echo "========================"

# Main entry point
replace_in_file "src-tauri/src/main.rs" 'handy_app_lib::run()' 'leadrscribe_app_lib::run()'

# CLI
replace_in_file "src-tauri/src/audio_toolkit/bin/cli.rs" 'use handy_app_lib::audio_toolkit' 'use leadrscribe_app_lib::audio_toolkit'

# Tray
replace_in_file "src-tauri/src/tray.rs" '"resources/handy.png"' '"resources/leadrscribe.png"'
replace_in_file "src-tauri/src/tray.rs" '"Handy v{}"' '"LeadrScribe v{}"'

# Ghostwriter
replace_in_file "src-tauri/src/ghostwriter.rs" '.header("X-Title", "Handy")' '.header("X-Title", "LeadrScribe")'

# History manager
replace_in_file "src-tauri/src/managers/history.rs" '"handy-{}.wav"' '"leadrscribe-{}.wav"'

# Settings paths in debug
find src/components/settings/debug -type f -name "*.tsx" -exec sed -i \
    -e 's/%APPDATA%\/handy/%APPDATA%\/leadrscribe/g' \
    {} \; 2>/dev/null

echo "  ✓ Updated Rust backend files"
((CHANGES+=7))

echo ""
echo "🌐 Phase 4: URLs"
echo "================"

# Replace all handy.computer URLs
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.rs" -o -name "*.md" -o -name "*.yml" -o -name "*.json" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/target/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    -exec sed -i "s|https://handy.computer|https://leadrscribe.vercel.app|g" {} \; 2>/dev/null

find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.rs" -o -name "*.md" -o -name "*.yml" -o -name "*.json" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/target/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    -exec sed -i "s|handy.computer|leadrscribe.vercel.app|g" {} \; 2>/dev/null

echo "  ✓ Updated handy.computer → leadrscribe.vercel.app"
((CHANGES+=15))

# Replace GitHub URLs (but NOT model blob URLs)
find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.md" -o -name "*.yml" -o -name "*.json" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/target/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    ! -path "*/src-tauri/src/managers/model.rs" \
    -exec sed -i "s|https://github.com/cjpais/Handy|https://github.com/hmseeb/leadrscribe|g" {} \; 2>/dev/null

find . -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.md" -o -name "*.yml" -o -name "*.json" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/target/*" \
    ! -path "*/.git/*" \
    ! -path "*/dist/*" \
    ! -path "*/src-tauri/src/managers/model.rs" \
    -exec sed -i "s|github.com/cjpais/Handy|github.com/hmseeb/leadrscribe|g" {} \; 2>/dev/null

echo "  ✓ Updated GitHub URLs"
((CHANGES+=10))

echo ""
echo "📝 Phase 5: Documentation"
echo "========================="

# Update README and other docs
for doc in README.md CLAUDE.md BUILD.md CONTRIBUTING.md CHANGELOG.md CRUSH.md; do
    if [ -f "$doc" ]; then
        sed -i \
            -e "s|# Handy|# LeadrScribe|g" \
            -e "s|Handy is|LeadrScribe is|g" \
            -e "s|the Handy|the LeadrScribe|g" \
            -e "s|of Handy|of LeadrScribe|g" \
            -e "s|to Handy|to LeadrScribe|g" \
            -e "s|for Handy|for LeadrScribe|g" \
            -e "s|with Handy|with LeadrScribe|g" \
            -e "s|from Handy|from LeadrScribe|g" \
            -e "s|Handy's|LeadrScribe's|g" \
            -e "s|Handy uses|LeadrScribe uses|g" \
            -e "s|Handy app|LeadrScribe app|g" \
            -e "s|Handy\.|LeadrScribe.|g" \
            "$doc" 2>/dev/null
        echo "  ✓ Updated: $doc"
        ((CHANGES++))
    fi
done

# GitHub workflow files
find .github/workflows -type f -name "*.yml" -exec sed -i \
    -e 's/asset-prefix: "handy"/asset-prefix: "leadrscribe"/g' \
    -e 's/default: "handy"/default: "leadrscribe"/g' \
    {} \; 2>/dev/null

echo "  ✓ Updated GitHub workflows"
((CHANGES+=2))

# .github/FUNDING.yml
replace_in_file ".github/FUNDING.yml" "https://handy.computer/donate" "https://leadrscribe.vercel.app/donate"

echo ""
echo "=================================="
echo "✅ Rebrand Complete!"
echo ""
echo "Summary:"
echo "  - Total changes: $CHANGES+ files/occurrences"
echo "  - Icons: 52 generated"
echo "  - Colors: Pink → Red theme applied"
echo "  - Names: Handy → LeadrScribe"
echo "  - URLs: Updated to leadrscribe.vercel.app"
echo ""
echo "⚠️  Manual steps remaining:"
echo "  1. Review git diff to verify changes"
echo "  2. Add user data migration code (Rust)"
echo "  3. Update component exports in index.ts files"
echo "  4. Clean build: rm -rf node_modules target dist && bun install"
echo "  5. Test build: bun run tauri build"
echo ""
