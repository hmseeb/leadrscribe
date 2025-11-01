# LeadrScribe 2025 - Quick Start Guide

## 🚀 Testing the Rebrand

### 1. Build and Run

```bash
# Build frontend
bun run build

# Run in dev mode
bun run tauri dev

# Or build for production
bun run tauri build
```

### 2. First Launch Experience

When you first open the app:

1. **Onboarding** - If no models exist, download a Whisper model
2. **Dashboard Appears** - You'll see the new primary view with:
   - Welcome message
   - Stats cards (all zeros initially)
   - 4 default profiles (Meeting, Note, Code, Email)
   - Empty state with friendly message

### 3. Test Key Features

#### **Dashboard**
- Open app → Should land on Dashboard (not Settings!)
- Verify stats cards display
- Check profile selector shows 4 profiles
- Try searching (should show empty state)

#### **Profiles**
- Click "Profiles" in sidebar
- Click "+ New Profile"
- Choose icon, color, name
- Add custom AI instructions
- Save and verify it appears in list

#### **Recording + Streaming**
1. Use your global shortcut to start recording
2. Speak something
3. Release shortcut
4. Watch overlay:
   - "Transcribing..." appears
   - Switches to "Ghostwriting..."
   - **TEXT STREAMS IN REAL-TIME** ✨ (if ghostwriter mode enabled)
5. Text pastes to active app

#### **Search**
- Click "Search" in sidebar
- Type keywords
- Verify FTS5 search works instantly
- Try filters:
  - Date range
  - Profile filter
  - Saved only toggle

#### **Command Palette**
- Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux)
- Palette appears
- Type "dashboard" → navigate
- Try searching transcriptions
- Use arrow keys to navigate
- Press Enter to select

#### **Milestones**
- Record your 1st transcription → See "🎉 First transcription!"
- Record 10 total → See "⚡ 10 transcriptions!"
- Celebration banner appears for 5 seconds

### 4. Verify Backend

```bash
# Check backend compiles
cd src-tauri
cargo check
# Should show 4 warnings (dead code) but 0 errors

# Check all commands registered
grep "commands::" src/lib.rs | wc -l
# Should show ~56 commands
```

### 5. Database Verification

After running the app once, check the database:

```bash
# On macOS
open ~/Library/Application\ Support/com.leadrscribe.app/history.db

# On Windows
# Navigate to %APPDATA%\com.leadrscribe.app\history.db

# Check tables exist:
# - transcription_history (with new columns)
# - profiles (with 4 default profiles)
# - tags
# - transcription_tags
# - transcription_fts (FTS5 virtual table)
```

---

## 🎯 Testing Checklist

### Visual/UX
- [ ] Dashboard is the default view (not Settings)
- [ ] Stats cards animate on load
- [ ] Profile selector is clickable
- [ ] Search bar has instant results
- [ ] Empty states are friendly
- [ ] Sidebar shows all sections
- [ ] Dark mode works
- [ ] Animations are smooth (60fps)

### Features
- [ ] Command palette opens with ⌘K/Ctrl+K
- [ ] Profiles can be created/edited/deleted
- [ ] Tags autocomplete works
- [ ] Search filters work (date, profile, saved)
- [ ] Streaming ghostwriter shows live text
- [ ] Celebration appears on milestones
- [ ] Recent transcriptions display correctly

### Backend
- [ ] `cargo check` passes (4 warnings OK)
- [ ] All 6 migrations run on first start
- [ ] 4 default profiles created
- [ ] FTS5 search is fast (<1ms)
- [ ] Profile/tag APIs work
- [ ] Streaming events fire correctly

### Performance
- [ ] Dashboard loads in <200ms
- [ ] Search responds in <100ms
- [ ] Ghostwriter streams at ~20 tokens/sec
- [ ] No UI jank or freezing
- [ ] Memory usage is reasonable

---

## 🐛 Common Issues

### Issue: "No models available"
**Solution**: Run onboarding to download a Whisper model first

### Issue: Command palette doesn't open
**Solution**: Make sure you're pressing ⌘K (not Cmd+Shift+K)

### Issue: Streaming ghostwriter doesn't work
**Solution**:
1. Check Output Mode is set to "Ghostwriter" in Settings
2. Verify OpenRouter API key is configured
3. Check network connection

### Issue: Search returns no results
**Solution**: Make sure you have recorded at least one transcription

### Issue: Database errors on startup
**Solution**: Delete `history.db` and restart app (migrations will recreate it)

---

## 📊 What to Look For

### "WOW" Moments
1. **Opening the app** → Dashboard instead of settings
2. **First recording** → Celebration animation
3. **Ghostwriter mode** → Watching text stream in real-time
4. **Command palette** → Instant keyboard-driven navigation
5. **Search** → Lightning-fast results with FTS5

### User Experience Improvements
- **Before**: "Where do I start?"
- **After**: Dashboard shows clear stats and recent activity

- **Before**: "How do I find old transcriptions?"
- **After**: Instant search + filters

- **Before**: "Waiting for ghostwriter..."
- **After**: Watching AI rewrite in real-time

- **Before**: "No context switching"
- **After**: Profile selector for different use cases

---

## 🎉 Success Criteria

The rebrand is successful if:

1. ✅ User opens app and doesn't recognize it
2. ✅ Dashboard provides clear overview
3. ✅ Search is instant and powerful
4. ✅ Streaming feels magical
5. ✅ Celebrations make them smile
6. ✅ Keyboard shortcuts feel natural
7. ✅ Everything compiles without errors

---

## 📝 Notes

- First run will auto-create 4 default profiles
- Migrations are idempotent (safe to run multiple times)
- All data is stored locally in SQLite
- No breaking changes to existing transcriptions
- Old non-streaming ghostwriter still works as fallback

---

**Ready to test?** Run `bun run tauri dev` and experience the 2025 rebrand! 🚀
