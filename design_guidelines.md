# iOS Design Guidelines: DVD Burner & File Manager

## Architecture Decisions

### Authentication
**No authentication required.** This is a single-user utility app with local and cloud file management.

**Profile/Settings Implementation:**
- Include a Settings tab with user customization
- Generate 3 preset avatars with a technical/utility aesthetic (geometric icons in circles: disc icon, file icon, cloud icon)
- Display name field for personalization
- App preferences: notification settings, default burn speed, auto-sync toggle

### Navigation Structure
**Tab Bar Navigation** (3 tabs):

1. **Files** - File browser and selection interface
2. **Queue** - Burn queue management (center position - core action)
3. **Settings** - App preferences and device connection status

**Floating Action Button:**
- Microphone icon for voice commands
- Positioned bottom-right, above tab bar
- Persistent across all tabs
- Primary action: activate voice input

### Screen Specifications

#### 1. Files Screen
**Purpose:** Browse, select, and organize files for burning or cloud sync

**Layout:**
- Header: Transparent with right button (OneDrive sync status icon)
- Search bar integrated into navigation header
- Main content: Scrollable list of files/folders
- Safe area insets: top = headerHeight + Spacing.xl, bottom = tabBarHeight + Spacing.xl + 60 (for FAB)

**Components:**
- File/folder cards with icons, names, size, modification date
- Multi-select checkboxes (enabled via toolbar button)
- "Select for Burn" button (appears when items selected)
- Pull-to-refresh for OneDrive sync

#### 2. Queue Screen
**Purpose:** Manage burn queue and monitor disc capacity

**Layout:**
- Header: Transparent with right button ("Clear All")
- Main content: Scrollable queue list
- Disc capacity indicator (progress bar showing GB used/available)
- Bottom area: Connection status card (floating, above tab bar)
- Safe area insets: top = headerHeight + Spacing.xl, bottom = tabBarHeight + Spacing.xl + 60

**Components:**
- Draggable queue items (reorder priority)
- Swipe-to-delete on queue items
- "Burn to Disc" primary button (disabled until device detected)
- Device connection status card:
  - Icon: checkmark (green) or warning (orange)
  - Text: "HP DVD557s Connected" or "No Device Detected"
  - Small drop shadow (shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2)

#### 3. Settings Screen
**Purpose:** Configure app preferences and view system status

**Layout:**
- Header: Default navigation header (non-transparent), title: "Settings"
- Main content: Scrollable form/grouped list
- Safe area insets: top = Spacing.xl, bottom = tabBarHeight + Spacing.xl

**Components:**
- Profile section: Avatar (tappable to change), display name field
- Device Settings: Default burn speed (segmented control: 4x, 6x, 8x)
- Cloud Sync: OneDrive auto-sync toggle, sync frequency picker
- Notifications: Enable burn completion alerts
- About: App version, help documentation link

#### 4. Voice Command Modal (Native Modal)
**Purpose:** Process voice commands for app actions

**Layout:**
- Full-screen modal with blur background
- Center: Large pulsing microphone icon
- Below: Transcription text display
- Bottom: "Cancel" button

**Components:**
- Animated microphone icon (scale pulse during listening)
- Real-time text display of recognized speech
- Command confirmation alert before executing

## Design System

### Color Palette
**Primary Colors:**
- Primary Blue: #007AFF (iOS system blue - for CTAs and active states)
- Secondary Gray: #8E8E93 (for secondary text and inactive elements)
- Success Green: #34C759 (device connected status)
- Warning Orange: #FF9500 (device disconnected)
- Destructive Red: #FF3B30 (delete actions)

**Background Colors:**
- Background: #F2F2F7 (iOS system background light)
- Card Background: #FFFFFF
- Dark Mode Background: #000000
- Dark Mode Card: #1C1C1E

### Typography
**Font:** San Francisco (iOS system font)

**Text Styles:**
- Large Title: 34pt, Bold (screen headers)
- Title 1: 28pt, Regular (section headers)
- Title 2: 22pt, Regular (card headers)
- Headline: 17pt, Semibold (list item titles)
- Body: 17pt, Regular (standard text)
- Callout: 16pt, Regular (secondary info)
- Subheadline: 15pt, Regular (file metadata)
- Footnote: 13pt, Regular (timestamps, hints)
- Caption: 12pt, Regular (smallest text)

### Spacing System
- xs: 4pt
- sm: 8pt
- md: 12pt
- lg: 16pt
- xl: 24pt
- xxl: 32pt

### Visual Design

**Icons:**
- Use SF Symbols for all system actions (trash, folder, cloud, mic, settings)
- Use Feather icons from @expo/vector-icons for custom elements
- NEVER use emojis

**Cards:**
- Border radius: 12pt
- Background: Card Background color
- Padding: Spacing.lg
- No shadows by default (flat design)

**Buttons:**
- Primary Button: Filled, Primary Blue background, white text, height 44pt, border radius 8pt
- Secondary Button: Outlined, Primary Blue border, Primary Blue text, height 44pt, border radius 8pt
- Destructive Button: Filled, Destructive Red background, white text

**Floating Action Button:**
- Size: 56x56pt circle
- Background: Primary Blue
- Icon: White microphone (24pt)
- Shadow specifications:
  - shadowOffset: {width: 0, height: 2}
  - shadowOpacity: 0.10
  - shadowRadius: 2
- Position: bottom-right, 16pt from right edge, 16pt + tabBarHeight from bottom

**List Items:**
- Height: 60pt minimum
- Left icon (32x32pt)
- Title and subtitle layout (vertical stack)
- Right chevron or accessory
- Separator line (hairline, inset 16pt from left)
- Press state: opacity 0.6

**Connection Status Indicator:**
- Compact card design
- Height: 56pt
- Border radius: 12pt
- Horizontal layout: Icon (left) + Text (center) + Detail chevron (right)
- Background changes based on state (green tint when connected, orange when disconnected)

**Progress Indicators:**
- Disc capacity bar: Height 8pt, rounded caps, Primary Blue fill
- Percentage text below bar (Caption style)

### Interaction Design

**Touch Feedback:**
- All touchable elements use opacity animation (0.6 on press)
- Haptic feedback on primary actions (burn button, voice activation)
- Swipe gestures on queue items for delete
- Long press on files for multi-select mode

**Voice Command Flow:**
1. Tap FAB → Modal appears with blur animation
2. Microphone pulses → Listening state
3. Speech transcribed → Displayed in real-time
4. Command recognized → Confirmation alert
5. User confirms → Action executes, modal dismisses

**Burn Process:**
1. Tap "Burn to Disc" button
2. Alert confirms action ("Burn X files to disc?")
3. User confirms
4. Queue screen shows progress overlay
5. Completion notification + success animation

### Accessibility Requirements

**VoiceOver Support:**
- All interactive elements have descriptive labels
- File list announces "File name, size, date modified"
- Queue items announce position in queue
- Connection status read as "Device status: Connected/Disconnected"

**Dynamic Type:**
- All text scales with system font size settings
- Layout adapts to maintain readability at large text sizes

**Color Contrast:**
- All text meets WCAG AA standards (4.5:1 for body text)
- Status indicators include icons, not just color coding

**Touch Targets:**
- Minimum 44x44pt for all interactive elements
- Adequate spacing between adjacent touch targets (Spacing.sm minimum)

### Critical Assets

**Generated Assets (Required):**
1. **User Avatar Presets** (3 options, technical aesthetic):
   - Geometric disc icon in circle (minimalist optical disc representation)
   - Geometric file/folder icon in circle (stacked papers)
   - Geometric cloud icon in circle (cloud with upward arrow)
   - Style: Line art, monochromatic, 120x120pt

**No other custom assets required.** All other UI elements use SF Symbols or standard system components to maintain native iOS aesthetic.