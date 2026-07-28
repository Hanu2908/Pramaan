---
name: react-vite-expert
description: Enforces best practices for React + Vite development, specifically optimizing for performance, TypeScript strictness, and avoiding known version conflicts (e.g. React 19/Vite 7 issues).
---

# React & Vite Expert Skill

When working on this frontend project, strictly adhere to the following principles:

## 1. Version Constraints (Critical)
*   **React Version**: This project uses React 18. Do NOT upgrade to React 19 or install experimental React features, as it conflicts with the Vite/Rolldown bundler currently in use.
*   **Vite Version**: Stick to Vite 5.x.

## 2. Component Architecture
*   **Functional Components Only**: Always use modern React Functional Components with Hooks. Never use Class components.
*   **TypeScript**: Enforce strict typing. Avoid `any`. Define `interface` or `type` for all props and state.
*   **Keep it Modular**: Break down massive files. If a component exceeds 150 lines, evaluate if it can be broken down into sub-components.

## 3. State Management & Hooks
*   **Performance**: Use `useMemo` for expensive calculations (like filtering large news arrays) and `useCallback` for functions passed as props to avoid unnecessary re-renders.
*   **No Prop Drilling**: Use React Context (like our `ThemeContext.tsx`) for global UI state rather than drilling props down more than 2 levels.

## 4. Coding Standards
*   **Clean Imports**: Group imports logically (React first, then third-party libraries, then local components, then local data/types, then CSS).
*   **No Console Logs**: Remove all `console.log` statements before finalizing code. Handle errors gracefully using try/catch blocks.
