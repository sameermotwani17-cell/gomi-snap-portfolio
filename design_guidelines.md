# GOMI SNAP 3D Marketing Landing Page Design Guidelines

## Design Approach: Reference-Based with 3D Innovation

**Primary References**: Apple product pages (premium 3D presentation), Stripe (clean sections with depth), Awwwards winners (3D WebGL experiences)

**Core Principle**: Immersive Environmental Storytelling - 3D elements create emotional connection while maintaining clarity of mission and call-to-action.

---

## Typography

**Font Stack**: 
- Primary: Inter / SF Pro Display
- Japanese: Noto Sans JP

**Hierarchy**:
- Hero Headline: text-6xl to text-7xl font-bold (60-72px desktop)
- Section Headlines: text-4xl font-bold (36-48px)
- Feature Titles: text-2xl font-semibold (24px)
- Body Copy: text-lg (18px for readability)
- CTA Buttons: text-base font-semibold (16px)
- Labels/Stats: text-sm font-medium (14px)

**Treatment**: Tight tracking for headlines (-0.02em), generous line-height (1.5) for Japanese text, crisp anti-aliasing

---

## Layout System

**Spacing Units**: Tailwind 6, 8, 12, 16, 24 - establishing consistent vertical rhythm

**Section Architecture**:
- Hero: 85vh with 3D canvas background, centered content
- Feature Sections: py-24 (desktop), py-16 (mobile)
- Stats/Impact: py-20 with centered max-w-6xl container
- CTA Sections: py-32 for emphasis
- Footer: py-16 with rich content grid

**Container Strategy**:
- Hero content: max-w-4xl centered
- Feature grids: max-w-7xl with grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Text sections: max-w-3xl for optimal reading
- Full-bleed: 3D canvas sections at w-full

---

## Page Structure (7 Core Sections)

### 1. Hero Section (85vh)
**3D Canvas Background**: Floating animated trash bags (Green, Pink, Transparent) with gentle rotation and parallax movement

**Content Layer** (centered, z-10):
- Large logo wordmark with subtle glow
- Hero headline (bilingual stack): "Transform Trash Classification" / "ゴミ分別を変革する"
- Subheadline: Mission statement (1-2 lines)
- Primary CTA: Large button "Download App" (w-64, h-14) with backdrop-blur-xl
- Secondary CTA: "Watch Demo" ghost button
- Trust indicator: "Hult Prize 2024 Finalist" badge

**Visual Treatment**: Gradient overlay (dark bottom to transparent) ensuring text legibility over 3D scene

### 2. Problem Statement Section
**Layout**: Single column, max-w-3xl, centered
- Compelling statistic with large number (text-6xl)
- Problem narrative in bilingual format
- Supporting image: Photo of confused person with Japanese trash bags
- Smooth fade-in scroll animation

### 3. How It Works (3-Step Process)
**Layout**: 3-column grid (stacks on mobile)

Each column card:
- Large numeral (01, 02, 03) with gradient treatment
- Icon: Camera, AI brain, Sorted bags
- Title: "Snap", "Analyze", "Sort"
- Description (3-4 lines)
- Staggered entrance animation (150ms delay between cards)

### 4. 3D Product Demo Section (Full-width)
**3D Canvas**: Phone mockup with app interface rotating in space, trash bags orbiting around it
**Side Content** (2-column with 3D):
- Features list with checkmarks
- Real-time analysis speed stat
- Accuracy percentage with animated counter
- Parallax scroll: Phone tilts as user scrolls

### 5. Impact & Stats Grid
**Layout**: 4-column stat cards (2-column tablet, stack mobile)

Each stat card (glass morphism):
- Large animated number (counting up on scroll into view)
- Label: "Users", "Classifications", "CO2 Saved", "Cities"
- Small icon above number
- Subtle gradient backdrop unique to each

### 6. Beppu City Integration Section
**Layout**: 2-column (image + content)
- Left: Image of Beppu cityscape with overlay of bag classification
- Right: Story of local implementation, benefits to community
- Include municipal partnership badges
- Pull quote from local official with photo

### 7. Social Proof & Partners
**Layout**: Centered content with logo grid
- Hult Prize prominent badge
- Partner logos grid (3-4 per row, grayscale with hover)
- Judge testimonial with photo and credentials
- Investment readiness indicator

### 8. Final CTA Section (py-32)
**Layout**: Centered with 3D accent
- 3D floating phone mockup (smaller scale)
- Headline: "Ready to Transform Waste Management?"
- Dual CTA buttons side-by-side
- Email capture for updates (inline form)
- App store badges (iOS/Android) below

### 9. Footer (Comprehensive)
**Layout**: 4-column grid (stacks mobile)
- Column 1: Logo, mission tagline, social links
- Column 2: Product links (Features, Pricing, Demo)
- Column 3: Company (About, Hult Prize, Team, Contact)
- Column 4: Newsletter signup + language toggle
- Bottom bar: Copyright, Privacy Policy, Terms

---

## 3D Implementation Specifications

**Trash Bag Models**:
- Three distinct bag geometries (cylindrical mesh)
- Materials: Semi-transparent with bag texture, reflecting Beppu colors
- Animation: Slow rotation (20s per cycle), gentle float (up/down 50px, 8s cycle)
- Parallax: Move opposite to scroll direction at 0.3x speed

**Lighting**:
- Soft ambient light (neutral tone)
- Directional light from top-right (creates depth)
- Subtle rim lighting on bags for definition

**Performance**:
- Low-poly models (< 1000 vertices per bag)
- Optimized textures (compressed PNG/WebP)
- Pause 3D animation when section out of viewport

---

## Component Library

### Glass Morphism Cards
- backdrop-blur-xl with semi-transparent background
- border: 1px with reduced opacity
- shadow-2xl with subtle tint
- rounded-3xl corners
- Hover: lift effect (translateY -4px)

### CTA Buttons (on images/3D)
- Background: backdrop-blur-xl with tinted semi-transparent fill
- Large touch targets (min h-14, px-12)
- No hover background changes (button component handles states)
- Clear, bold text with icon spacing

### Feature Icons
- Use Heroicons via CDN
- Size: 32px within cards, 48px for hero elements
- Stroke weight: 2px for consistency

### Scroll Animations
- Fade-up entrance: Elements start 40px below, opacity 0
- Stagger timing: 100-150ms between sequential items
- Number counters: Animate from 0 to final value over 1.2s
- Parallax: Smooth transform based on scroll position (requestAnimationFrame)
- Intersection Observer triggers (threshold: 0.2)

---

## Images

**Hero Section**: No background image - 3D canvas fills entire background

**Required Images**:
1. **Problem Section**: Photo of person looking confused at trash sorting bins (authentic Japanese context), full-width rounded-2xl
2. **Beppu City Section**: Aerial/scenic photo of Beppu with visible landmarks, split-screen with content
3. **Judge Testimonial**: Professional headshot (circular mask, 80px)
4. **Phone Mockups**: High-res PNG of app interface screens for 3D model texture mapping

**Image Treatment**: All photos have subtle gradient overlay (10% dark from bottom) for text legibility, rounded-3xl corners, shadow-xl depth

---

## Animations (Purposeful Only)

- **Page Load**: Hero 3D bags fade in with gentle scale (0.8 to 1.0, 1s)
- **Scroll Triggers**: Section content fades up when 20% visible
- **Number Counters**: Stats animate once when scrolled into view
- **3D Parallax**: Continuous smooth movement tied to scroll position
- **Hover States**: Subtle card lift (4px), no color shifts on blurred buttons
- **CTA Pulse**: Very subtle scale pulse on primary button (1.0 to 1.02, 3s loop)

**Animation Budget**: Focus effects on hero 3D scene and stats counter - keep everything else subtle

---

## Accessibility

- Alt text for all images describing context
- ARIA labels for 3D canvas ("Animated trash bag illustration")
- Keyboard navigation for all interactive elements
- Reduced motion media query: Disable 3D animations, use static images
- High contrast maintained across glass morphism overlays
- Focus indicators visible on all buttons and links

---

**Design Mandate**: Create an unforgettable first impression that demonstrates technical sophistication while clearly communicating environmental impact and business viability. Every section must justify its presence with compelling content - no filler.