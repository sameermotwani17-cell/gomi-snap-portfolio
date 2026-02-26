# GOMI SNAP

**AI-Powered Trash Classification for Smarter Waste Disposal**

GOMI SNAP helps users instantly identify the correct trash disposal category for any household item. Simply snap a photo, and get disposal instructions in seconds - in your language, following your city's rules.

## The Problem

Improper waste sorting is a global challenge. In Japan alone, complex municipal recycling rules lead to confusion, especially for international residents and students. Incorrect disposal causes environmental harm, increased processing costs, and community friction.

## Our Solution

GOMI SNAP uses AI-powered image recognition to:
- Identify items from photos instantly
- Provide disposal instructions following local city rules (starting with Beppu City, Japan)
- Support **6 languages** (English, Japanese, Chinese, Burmese, Korean, Indonesian) with more coming soon
- Deliver results in under 5 seconds ("The 5-Second Rule")

## Key Features

- **AI Image Recognition**: Powered by OpenAI GPT-4o Vision API for accurate item identification
- **Multi-Language Support**: English, Japanese, Chinese (Simplified), Burmese, Korean, and Indonesian - with more languages planned
- **Smart Clarification System**: Asks follow-up questions when needed (e.g., "Is this paper contaminated with oil?")
- **Multi-Part Item Detection**: Separates complex items into components (e.g., PET bottle → body, cap, label)
- **Mobile-First Design**: Optimized for on-the-go use with camera integration
- **Intelligent Caching**: Reduces API costs through perceptual image hashing
- **Location Analytics**: Track environmental impact by region (with user consent)

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite for fast development
- Tailwind CSS + Shadcn UI
- TanStack Query for data fetching
- Framer Motion for animations
- Three.js for 3D landing experience

### Backend
- Node.js + Express
- OpenAI GPT-4o Vision API
- PostgreSQL with Drizzle ORM
- Sharp for image processing

## Beppu City Disposal Categories

| Category | Bag Color | Examples |
|----------|-----------|----------|
| Burnable | Yellow | Food waste, paper, textiles |
| Non-burnable | Blue | Ceramics, glass, small appliances |
| Recyclable Plastics | Pink | PET bottles, plastic containers |
| Recyclable Other | Green | Cans, bottles, cardboard |
| Oversized | Sticker | Furniture, large appliances |
| Hazardous | Special | Batteries, fluorescent bulbs |

## Team

Built with passion by APU students for the **Hult Prize 2025**:

- **Sameer** - Founder & CEO/CTO
- **Momoka** - Co-CEO
- **Ellysen** - COO
- **Makarem** - CFO
- **Sami** - Videographer & Photographer
- **Rania** - Head of Marketing

## Hult Prize Competition

GOMI SNAP is competing in the **Hult Prize 2025**, the world's largest student competition for social entrepreneurship. Our mission aligns with creating sustainable solutions for global waste management challenges.

**Campus Round Pitch**: January 11th, 2025

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
# Add OPENAI_API_KEY to your environment

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o Vision |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_KEY` | Admin dashboard access key (16+ characters) |

## Future Roadmap

- Expand to more cities worldwide
- Offline mode with cached rules
- Community-contributed disposal guides
- Gamification and environmental impact tracking
- Integration with municipal waste collection schedules

## License

This project is developed for the Hult Prize competition and educational purposes.

---

**Made with care for our planet** | APU, Beppu, Japan
