# TCCANE Website Project Summary

This document records the design, implementation, and features of the **Tzu Chi Collegiate Association Northeast Region (TCCANE)** website developed for this repository.

---

## 📁 Repository Structure

The website is fully built within the [tccane-website](file:///Users/admin/OneDrive/Bryan_Docs/Tech/Personal_projects/tccane-website) directory:

- **[index.html](file:///Users/admin/OneDrive/Bryan_Docs/Tech/Personal_projects/tccane-website/index.html)**: Core structure, containing descriptive metadata, SEO optimizations, custom inline SVGs, and all structural sections.
- **[styles.css](file:///Users/admin/OneDrive/Bryan_Docs/Tech/Personal_projects/tccane-website/styles.css)**: Modern visual styles, custom color variables (light/dark themes), custom responsive grid structures, glassmorphism filters, animations, and transitions.
- **[app.js](file:///Users/admin/OneDrive/Bryan_Docs/Tech/Personal_projects/tccane-website/app.js)**: Interface controller managing state toggles (light/dark mode memory), hamburger menus, accordion logic, uniform progress calculator, active cards filter, and form submissions.
- **[hero.png](file:///Users/admin/OneDrive/Bryan_Docs/Tech/Personal_projects/tccane-website/hero.png)**: Custom high-fidelity illustration asset matching the organization's color scheme and focus on sustainability and volunteer growth.
- **[SUMMARY.md](file:///Users/admin/OneDrive/Bryan_Docs/Tech/Personal_projects/tccane-website/SUMMARY.md)**: (This file) A local reference documenting exactly what was built.

---

## 🎨 Premium Theme & Styling System

The styling rules established in `styles.css` utilize custom properties to handle transitions and complete native **Light and Dark theme adaptations**:

| Variable | Light Theme | Dark Theme | Purpose |
| :--- | :--- | :--- | :--- |
| `--primary` | `#103A5C` (Deep Blue) | `#3AAFA9` (Mint Teal) | Core theme accents & action buttons |
| `--secondary` | `#3AAFA9` (Mint Teal) | `#103A5C` (Deep Blue) | Sub-accents & card indicators |
| `--background`| `#F4F7FA` (Soft Grey-Blue)| `#081017` (Deep Slate) | Overall body canvas background |
| `--surface` | `#FFFFFF` (Pure White) | `#0E1823` (Rich Slate) | Cards, inputs, and panel backings |
| `--glass-bg` | `rgba(255, 255, 255, 0.7)`| `rgba(14, 24, 35, 0.75)` | Frosted glass card backings |

---

## ⚙️ Interactive Functions & Mechanics

The client logic in `app.js` is pure Vanilla JS, optimized for performance and zero external dependencies:

1. **Light / Dark Mode State**: Detects browser settings on load, checks persistent settings stored in `localStorage`, and updates body classes seamlessly.
2. **Uniform Eligibility Tracker**: 
   - Dynamically calculates requirements progress based on four criteria: Completed Hours (40% weight), unique Event Types (20% weight), Conference Attendance (20% weight), and Advisor Approval (20% weight).
   - Animates a smooth progress bar and changes status badge colors (`Inquirer` ➔ `Candidate` ➔ `Active Volunteer` ➔ `Uniform Eligible`).
   - Generates helpful hints on next steps based on what criteria remain unchecked.
3. **Accordion System (10 Precepts)**: Accessible click events that toggle trigger attributes and animate height transitions, allowing clean, clutter-free reading.
4. **Chapters Grid Filtering**: Instantly filters campus vs. community chapter cards with quick CSS opacity transitions.
5. **Inquiry submission feedback**: Personalizes feedback based on the user's input type (e.g. reminding them of the 2-4 weeks' notice rule if requesting service hours verification).

---

## 🚀 Local Review Instructions

To view the website immediately:

1. Open your terminal and change directory to the project folder:
   ```bash
   cd /Users/admin/OneDrive/Bryan_Docs/Tech/Personal_projects/tccane-website
   ```
2. Serve the static site using Python:
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser and navigate to:
   **[http://localhost:8000](http://localhost:8000)**
