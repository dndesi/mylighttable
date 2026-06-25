# Projekt-Briefing: Bildgalerie / Lichttisch-App
**Erstellt:** 25.06.2026  
**Für:** Neues Cowork-Projekt mit Claude  
**Von:** Distill-Voice-Projekt übertragen

---

## 1. Projektbeschreibung

Eine web-basierte Bildgalerie (Lichttisch-Stil), über die Daniel Fotos und Videos hochlädt und anderen zum Download zur Verfügung stellt. Jede Galerie ist durch einen vierstelligen PIN-Code geschützt.

---

## 2. Anforderungen (Feature-Liste)

### Frontend (öffentlich, PIN-geschützt)
- **PIN-Schutz:** Vierstelliger Zahlencode pro Galerie — ohne korrekten Code kein Zugang
- **Hero-Bild:** Großes Bild im Kopfbereich der Galerie (vom Backend auswählbar)
- **Beschreibungstext:** Freitextfeld direkt unter dem Hero-Bild (vom Backend befüllbar)
- **Galerie-Ansicht:** Lichttisch-Stil — Fotos und Videos in einem Raster angezeigt
- **Download-Funktion:** Jedes Bild/Video einzeln downloadbar
- **Responsives Design:** Funktioniert auf Desktop und Mobile

### Backend (passwortgeschützt, nur für Daniel)
- **Galerie erstellen/verwalten:** Neue Galerien anlegen, benennen, PIN setzen
- **Medien hochladen:** Fotos (JPG, PNG, WEBP) und Videos (MP4, MOV) hochladen
- **Hero-Bild auswählen:** Aus den hochgeladenen Bildern eines als Hero-Bild festlegen
- **Beschreibungstext eingeben:** Freitextfeld das im Frontend sichtbar ist
- **Ablaufdatum einstellen:** Datum-Picker — nach Ablauf werden Dateien automatisch gelöscht
- **Galerie-Übersicht:** Alle Galerien im Überblick (Status, Ablauf, Anzahl Medien)

### Speicher & Infrastruktur
- **Google Drive** als Speicherort für alle Medien (wie in Distill Voice)
- Ordnerstruktur pro Galerie in Drive
- Metadaten (PIN, Hero-Bild, Text, Ablaufdatum) in einer JSON-Datei in Drive gespeichert

---

## 3. Technische Architektur (Empfehlung)

```
/index.html          → Frontend (Galerie-Ansicht, PIN-Eingabe)
/admin.html          → Backend (Upload, Verwaltung)
/js/
  app.js             → Frontend-Logik
  admin.js           → Backend-Logik
  drive.js           → Google Drive API Wrapper
  auth.js            → PIN-Prüfung + Admin-Auth
/css/
  styles.css         → Shared Styles
  gallery.css        → Lichttisch/Grid
  admin.css          → Admin-Panel
/gallery_meta.json   → In Drive: Metadaten (PIN, Hero, Text, Ablauf)
```

**Tech-Stack:** Vanilla JS + HTML + CSS, keine Build-Tools, GitHub Pages tauglich

---

## 4. Zusammenarbeits-Regeln (aus Distill Voice übernommen)

### Prozess
- **Plan zuerst, dann warten:** Vor JEDER Implementierung kurz erklären was gemacht wird — dann explizit auf Daniels „ja" warten. Niemals direkt loslegen.
- **Plan zweimal prüfen:** Jeden Plan intern nochmal gegen den tatsächlichen Code-Pfad durchdenken (Variablen, Abhängigkeiten, Seiteneffekte) bevor er präsentiert wird.
- **Architektur-Denken vor Fixes:** Bei jedem Bug: (1) Was ist das Symptom? (2) Was ist die eigentliche Ursache? (3) Skaliert die Lösung oder verschiebt sie das Problem nur?
- **Tasks sofort abhaken:** Tasks direkt nach Erledigung als completed markieren — nicht warten bis Daniel nachfragt.

### Versionierung
- Bei JEDER Änderung (auch kleinen): Versionsnummer erhöhen + Changelog-Eintrag
- Cache-Busting: `<script src="js/app.js?v=1.0">` — bei jeder Version miterhöhen
- Nach jeder Versionsänderung automatisch den git-Befehl anzeigen:
  ```bash
  cd "/Users/danielnotzoldt/Documents/Cloude/Plaude Clone/Plaude Clone/[REPO-NAME]" && git add -A && git commit -m "v1.X – Kurzbeschreibung" && git push origin main
  ```

### UI/UX
- **? Help-Icons:** Bei JEDEM neuen UI-Element proaktiv `?`-Buttons ergänzen — ohne dass Daniel danach fragen muss
- **Immer `<button>` statt `<div onclick>`** — besonders wichtig für iOS Safari
- **Mobile Safe-Area:** Alle `position:fixed; bottom:X` Elemente brauchen `env(safe-area-inset-bottom)`
- **SVG in Buttons:** Globale CSS-Regel von Anfang an: `button svg { pointer-events: none; }`
- **Overlay-Reihenfolge:** Overlay A erst schließen, dann B öffnen — nie parallel
- **UI skalierbar planen:** Vor jedem Listen-Element fragen: "Was wenn es 50 davon gibt?"

### Google Drive / Cloud-Sync
- **Remote ist autoritativ:** Lokale Daten die remote fehlen, werden verworfen — kein UNION-Merge
- **Beim View-Öffnen frische Daten laden:** Jeder View der Drive-Daten zeigt, triggert beim Öffnen einen Sync
- **Sofort speichern, kein Debounce** für kritische Daten (Upload, Löschen, PIN-Änderung)

### Fehler-Vermeidung
- **localStorage hat ~5MB Limit** — für wachsende Daten (Galerien, Medien-Listen) IndexedDB oder Drive verwenden
- **`sed` niemals für Changelog-Updates** — immer Read + Edit (String-Match)
- **Nach Refactoring:** `grep -r "alteID" .` über alle JS-Dateien — keine verwaisten Referenzen
- **Render-Funktionen bei leeren Daten:** `''` zurückgeben, keine Fehlermeldung — Fehlerbehandlung im aufrufenden Code
- **Debounce nur für Texteingabe** — für explizite Nutzeraktionen sofortiger Write

### Mobile
- Jedes `position:fixed` Element mit Sidebar-Offset braucht `@media (max-width: 768px) { left: 0 }`
- Bottom-Sheet: Schließen-Button INNEN, nicht außen
- `touch-action: manipulation` auf alle Buttons setzen

---

## 5. Feature-Reihenfolge (empfohlen)

Große Features in nummerierte Arbeitspakete aufteilen, Reihenfolge begründen, Risiken vorab benennen.

**Paket 1 – Fundament**
- Dateistruktur + GitHub Repo anlegen
- Google Drive API einbinden (OAuth)
- Admin-Auth (einfaches Master-Passwort)

**Paket 2 – Backend Grundfunktion**
- Galerie erstellen (Name + PIN + Ablaufdatum)
- Bilder/Videos hochladen → Drive
- Hero-Bild auswählen
- Beschreibungstext eingeben

**Paket 3 – Frontend**
- PIN-Eingabe-Screen
- Galerie-Ansicht (Lichttisch-Grid)
- Hero-Bild + Text im Header
- Einzel-Download

**Paket 4 – Automatisierung**
- Ablaufdatum-Check: automatisches Löschen abgelaufener Galerien
- Status-Anzeige im Backend (Tage bis Ablauf)

**Paket 5 – Polish & Mobile**
- Responsive Design verfeinern
- Loading-States, Error-Handling
- Hilfe-Icons ergänzen

---

## 6. Noch offene Fragen (vor dem Start klären)

1. Soll es mehrere Galerien parallel geben, oder immer nur eine aktive?
2. Wie viele Bilder/Videos soll eine Galerie maximal fassen?
3. Soll der Download-Link sharebar sein (direkter URL mit PIN im Hash) oder immer manuell eingeben?
4. Soll das Backend nur für Daniel lokal zugänglich sein, oder auch online?
5. Soll es eine Vorschau (Thumbnail) für Videos geben?
6. GitHub Pages als Hosting, oder eigener Server?

---

## 7. GitHub-Setup (empfohlen)

```bash
# Neues Repo anlegen und ersten Commit pushen
cd "/Users/danielnotzoldt/Documents/Cloude/Plaude Clone/Plaude Clone/[REPO-NAME]"
git init
git add -A
git commit -m "v0.1 – Projekt-Setup"
git remote add origin https://github.com/dndesi/[REPO-NAME].git
git push -u origin main
```

---

## 8. Lessons Learned aus Distill Voice (universell anwendbar)

| # | Regel | Kontext |
|---|-------|---------|
| 1 | Cache-Busting `?v=X` an allen CSS/JS | Browser cachen aggressiv bei GitHub Pages |
| 2 | `?`-Help-Icons proaktiv bei jedem Feature | Daniel hat das explizit gewünscht |
| 3 | Drive-Sync beim View-Öffnen triggern | Multi-Gerät Datenkonsistenz |
| 4 | `button svg { pointer-events: none }` | SVG fängt sonst Click-Events ab |
| 5 | Overlays: erst schließen, dann öffnen | `position:fixed` liegt immer oben |
| 6 | Remote ist autoritativ beim Merge | UNION-Merge bringt gelöschte Daten zurück |
| 7 | Kritische Daten sofort speichern | Debounce verliert Daten beim Tab-Close |
| 8 | Mobile: `left:0` Media Query für Sidebars | Desktop-Offset bricht Mobile-Layout |
| 9 | Neue-Nutzer-Flow immer mitdenken | Auth-Optimierungen können neue User aussperren |
| 10 | localStorage Quota: max ~5MB | Wachsende Daten → IndexedDB oder Drive |
| 11 | `<button>` statt `<div onclick>` | iOS Safari feuert onclick auf Nicht-Buttons nicht |
| 12 | Safe-Area-Insets für fixierte Elemente | iPhone Home-Indicator blockiert Touch-Events |
| 13 | UI-State bei ALLEN auslösenden Events | Nicht nur beim direkten User-Event |
| 14 | Kontext-Limit proaktiv managen | Ab ~10 Versionsschritten neue Session ankündigen |
| 15 | ID-Grep nach Refactoring | Verwaiste Referenzen brechen still ab |

---

*Dieses Dokument ist das Startpaket für Claude im neuen Projekt. Alle Regeln, Prozesse und Lessons Learned aus Distill Voice sind hier enthalten.*
