# Google Cloud Setup – MyLighttable

Einmalig ~5 Minuten. Danach nie wieder nötig.

---

## Schritt 1 – Google Cloud Projekt anlegen

1. Gehe zu: https://console.cloud.google.com
2. Oben links auf **"Projekt auswählen"** → **"Neues Projekt"**
3. Name: `MyLighttable` → **Erstellen**

---

## Schritt 2 – Google Drive API aktivieren

1. Linkes Menü: **"APIs & Dienste"** → **"Bibliothek"**
2. Suche: `Google Drive API`
3. Klick auf **Google Drive API** → **Aktivieren**

---

## Schritt 3 – OAuth Consent Screen

1. Linkes Menü: **"APIs & Dienste"** → **"OAuth-Einwilligungsbildschirm"**
2. Benutzertyp: **Extern** → Erstellen
3. App-Name: `MyLighttable`
4. Support-E-Mail: deine E-Mail-Adresse
5. Unten: **Speichern und fortfahren** (durch alle Schritte klicken)
6. Beim Schritt **"Testnutzer"**: deine Google-E-Mail hinzufügen

---

## Schritt 4 – OAuth Client ID erstellen

1. Linkes Menü: **"APIs & Dienste"** → **"Anmeldedaten"**
2. Oben: **"Anmeldedaten erstellen"** → **"OAuth-Client-ID"**
3. Anwendungstyp: **Webanwendung**
4. Name: `MyLighttable Web`
5. **Autorisierte JavaScript-Quellen** hinzufügen:
   - `http://localhost` (zum Testen)
   - `https://DEIN-GITHUB-USERNAME.github.io` (für GitHub Pages)
6. Klick auf **Erstellen**
7. → Notiere die **Client-ID** (Format: `xxxxxxx.apps.googleusercontent.com`)

---

## Schritt 5 – API Key erstellen

1. **"Anmeldedaten erstellen"** → **"API-Schlüssel"**
2. → Notiere den **API-Schlüssel**
3. Optional: API-Schlüssel einschränken auf Google Drive API

---

## Schritt 6 – In config.js eintragen

Öffne `js/config.js` und trage ein:

```javascript
const CONFIG = {
  GOOGLE_CLIENT_ID: 'HIER_DEINE_CLIENT_ID.apps.googleusercontent.com',
  GOOGLE_API_KEY: 'HIER_DEIN_API_KEY',
};
```

---

## Schritt 7 – Lokal testen

Da OAuth eine echte Domain braucht, teste mit einem lokalen Server:

```bash
cd "/Users/danielnotzoldt/Documents/Cloude/MyLighttable/MyLighttable"
python3 -m http.server 8080
```

Dann im Browser: http://localhost:8080/admin.html

---

Danach kannst du das Projekt auf GitHub Pages deployen:

```bash
cd "/Users/danielnotzoldt/Documents/Cloude/MyLighttable/MyLighttable"
git init
git add -A
git commit -m "v1.0 – Projekt-Setup"
git remote add origin https://github.com/dndesi/MyLighttable.git
git push -u origin main
```

Und in den GitHub Repository-Einstellungen: **Pages** → Branch `main` → Speichern.
