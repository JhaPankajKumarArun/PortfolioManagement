MY PORTFOLIO — iPhone PWA

Files:
- index.html: your original portfolio app with PWA metadata added
- manifest.json: installable app information
- service-worker.js: caches the app shell for offline reopening
- icon-*.png: home-screen/app icons

INSTALL ON IPHONE
1. Upload the contents of this folder to an HTTPS static host.
2. Open the hosted index.html URL in Apple's Safari (not an in-app browser).
3. Tap Share, then Add to Home Screen.
4. Enable "Open as Web App" if that option appears, then tap Add.
5. Open Portfolio from the new Home Screen icon once while online. After the first
   successful load, the cached app shell can reopen offline.

PRIVACY / DATA
This package does not add a cloud database or send portfolio data to a server.
However, this does not prove how the original HTML handles data. Review its
existing import/export and browser-storage code before entering sensitive data.
The hosting provider stores the static app files; that is separate from portfolio
data entered into the app. Browser data can be lost if website data is cleared.

IMPORTANT
A PWA requires HTTPS for service workers (localhost is the development exception).
Opening index.html directly from the iPhone Files app will not install it as a PWA.
