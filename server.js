const express = require('express');
const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin');
const cors = require('cors');
const { config } = require('dotenv');

const PORT = process.env.PORT || 3000;
const app = express();

const keyPath = path.join(__dirname, 'serviceAccountKey.json')
if (!fs.existsSync(keyPath)) {
    console.error('serviceAccountKey.json not found!');
    process.exit(1);
}
admin.initializeApp({
    credential: admin.credential.cert(require(keyPath))
});
const db = admin.firestore();

app.set("view engine", "ejs")
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('public'));

const firebaseClientConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

async function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token.' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        req.user = decoded;
        next()
    } catch (err) {
        if (err.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }

}

// Automatski koristi sve iz mape public
app.get('/', (req, res) => {
    const dataPath = path.join(__dirname, 'public', 'filmovi.csv');
    const csv = fs.readFileSync(dataPath, 'utf8');
    const Papa = require('papaparse');
    const rezultat = Papa.parse(csv, { header: true });

    res.render('index', { filmovi: rezultat.data });
});
app.get('/galerija', (req, res) => {
    const dataPath = path.join(__dirname, 'images.json');
    const images = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    images.forEach((image, i) => {
        image.id = `slika${i + 1}`;
    });

    res.render('galerija', { images });
});

app.get('/slike', (req, res) => {
    const numImages = 12;
    const images = Array.from({ length: numImages }, (_, i) => ({
        full: `https://unsplash.it/900/600?random=${i + 1}`,
        thumb: `https://unsplash.it/300/200?random=${i + 1}`,
        title: `Slika film ${i + 1}`,
        id: `slika${i + 1}`
    }))

    res.render('slike', { images });
});

app.listen(PORT, () => {
    console.log(`Server pokrenut na portu ${PORT}`);
});
