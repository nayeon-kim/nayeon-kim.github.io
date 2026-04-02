# Deploying SF Sweep to your Website

This guide explains how to take the code from AI Studio and host it on your own personal website.

## 1. Prerequisites
- A Google Cloud Project with the **Maps JavaScript API** and **Places API** enabled.
- A web server or hosting provider (GitHub Pages, Netlify, Vercel, etc.).

## 2. Local Setup
1. **Download the code**: Use the "Export to ZIP" feature in the AI Studio Settings menu.
2. **Install Node.js**: Ensure you have Node.js installed on your computer.
3. **Install dependencies**:
   ```bash
   npm install
   ```

## 3. Configuration
1. Create a file named `.env` in the root directory.
2. Add your Google Maps API key:
   ```env
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

## 4. Building for Production
Run the following command to compile the application:
```bash
npm run build
```
This will create a `dist/` folder.

## 5. Deployment
Upload the **contents** of the `dist/` folder to your web server. 

### Hosting in a Subdirectory
If you want to host the app at `yoursite.com/parking/`, you must edit `vite.config.ts`:
```typescript
// vite.config.ts
export default defineConfig({
  base: '/parking/', // Add this line
  // ... rest of config
})
```

## 6. Security (CRITICAL)
Because this is a frontend-only app, your API key is technically public. You **must** restrict it:
1. Go to [Google Cloud Credentials](https://console.cloud.google.com/google/maps-apis/credentials).
2. Edit your API Key.
3. Under **Application restrictions**, select **Websites**.
4. Add your domain (e.g., `https://yourwebsite.com/*`).
5. Under **API restrictions**, select **Restrict key** and choose "Maps JavaScript API" and "Places API".
