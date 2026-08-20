# Hand Gesture AI

Eine kleine Browser-Anwendung, die fünf Handgesten direkt in Echtzeit erkennt. MediaPipe findet 21 Punkte der Hand. Verständliche Regeln prüfen anschließend, welche Finger ausgestreckt sind. Es ist kein Training nötig.

## Features

- Open Hand, Fist, Peace, Thumbs Up, Pointing und OK-Zeichen
- sofortige Erkennung ohne vorheriges Training
- zusätzlicher Training Mode als optionale ML-Demonstration
- Train/Test Split und Anzeige der Test-Accuracy
- Live-Vorschau mit Hand-Landmarks und Confidence
- kleine Play/Pause- und Lautstärke-Demo
- Speicherung von Samples und Modell nur im Browser
- statische Website, geeignet für Shared Hosting

## How it works

`Camera → MediaPipe Hand Landmarks → Finger-Regeln → Gesture`

MediaPipe übernimmt nur das Hand-Tracking. Es entscheidet nicht, ob eine Hand beispielsweise „Peace“ zeigt. Dafür prüft die App anhand der Landmark-Koordinaten, welche Finger ausgestreckt sind.

## Lokal starten

Die Kamera funktioniert nur auf `localhost` oder über HTTPS. Deshalb die Datei nicht einfach per Doppelklick öffnen, sondern einen kleinen lokalen Webserver starten:

```bash
python3 -m http.server 8000
```

Danach <http://localhost:8000> öffnen. Es müssen keine Python-Pakete installiert werden; Python dient hier nur als lokaler Webserver.

## Sofort ausprobieren

1. Unter **Live** auf **Kamera starten** klicken.
2. Eine Hand gut sichtbar und möglichst frontal in die Kamera halten.
3. Die App zeigt direkt beispielsweise **„Du zeigst Daumen hoch“** an.

## Optional: eigene Trainingsdaten aufnehmen

1. Unter **Training** die Kamera starten.
2. Eine Geste wählen und **Aufnahme starten** anklicken.
3. Die Hand während der Aufnahme leicht bewegen und drehen.
4. Für jede gewünschte Geste ungefähr 100 Samples aufnehmen.
5. **Modell trainieren** anklicken, um den Train/Test-Split und die Accuracy auszuprobieren.

Der Training Mode bleibt als zusätzliche ML-Demonstration erhalten. Für die
normale Live-Erkennung wird er nicht benötigt.

Für ein erstes Modell reichen technisch zwei Klassen mit je zehn Samples. Zuverlässiger wird es mit allen Klassen und abwechslungsreichen Beispielen. Samples und Modell liegen im `localStorage` genau dieses Browsers.

## Auf Shared Hosting hochladen

Den Inhalt dieses Ordners per FTP oder Dateimanager in den öffentlichen Webordner laden, oft `public_html`, `www` oder `htdocs`:

- `index.html`
- `styles.css`
- `app.js`

Es ist kein Build-Schritt, Node.js, Python oder Backend nötig. Die Website muss über **HTTPS** erreichbar sein, weil Browser die Webcam auf normalen HTTP-Seiten sperren. Außerdem muss der Hosting-Tarif ausgehende Browserzugriffe auf die in `app.js` verwendeten MediaPipe-CDNs nicht einschränken (gewöhnliches Shared Hosting tut das nicht).

Beim Aktualisieren immer alle drei Dateien ersetzen. Anschließend die Seite mit
`Ctrl+F5` (Windows/Linux) beziehungsweise `Cmd+Shift+R` (macOS) neu laden, damit
keine alte JavaScript-Datei aus dem Browser-Cache verwendet wird.

Wichtig: Browserdaten werden pro Domain und Browser gespeichert. Nach einem Domainwechsel oder Löschen der Website-Daten muss neu aufgenommen und trainiert werden.

## Projektdateien

- `index.html` – Oberfläche und drei Ansichten
- `styles.css` – responsives Design
- `app.js` – Kamera, Tracking, Features, Training und Prediction
- `HOW_IT_WORKS.md` – technische Erklärung in einfacher Sprache

## What I learned

Das Projekt verbindet Computer Vision und klassisches Machine Learning: Aus Kamerabildern werden Landmark-Daten, aus diesen Daten robuste Features und aus Trainingsbeispielen ein Klassifikator. Der Train/Test Split zeigt, ob das Modell auch zurückgehaltene Beispiele erkennt. Bei der Echtzeit-Prediction zeigt die Confidence, wie eindeutig die nächsten Nachbarn für eine Klasse stimmen.

## Datenschutz

Die Kamerabilder werden nicht hochgeladen oder gespeichert. `localStorage` enthält ausschließlich normalisierte Zahlenwerte der Hand-Landmarks und Metadaten des trainierten Modells.
