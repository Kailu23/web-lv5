'use strict';
require('dotenv').config();

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

app.get('/glazba', (req, res) => {
    res.render('glazba', { firebaseConfig: firebaseClientConfig });
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() })
});

app.get('/api/pjesme', verifyToken, async (req, res) => {
    try {
        const { izvodjac, zanr, raspolozenje, godina_min, godina_max, bpm_min, bpm_max } = req.query;

        let ref = db.collection('pjesme');

        if (izvodjac) ref = ref.where('izvodjac', '==', izvodjac);
        if (zanr)     ref = ref.where('zanr', '==', zanr);
        if (raspolozenje) ref = ref.where('raspolozenje', '==', raspolozenje);

        const snapshot = await ref.get();
        let pjesme = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (godina_min) pjesme = pjesme.filter(p => p.godina >= +godina_min);
        if (godina_max) pjesme = pjesme.filter(p => p.godina <= +godina_max);
        if (bpm_min)    pjesme = pjesme.filter(p => p.bpm >= +bpm_min);
        if (bpm_max)    pjesme = pjesme.filter(p => p.bpm <= +bpm_max);

        pjesme.sort((a, b) => a.naziv.localeCompare(b.naziv));

        res.json(pjesme);
    } catch (err) {
        res.status(500).json({ greska: err.message });
    }
});

app.post('/api/pjesme', verifyToken, async (req, res) => {
    const { naziv, izvodjac, zanr, trajanje, bpm, godina, raspolozenje } = req.body;

    if (!naziv?.trim()) {
        return res.status(400).json({ error: 'Naziv je obavezan.' });
    }
    if (!zanr) {
        return res.status(400).json({ error: 'Zanr je obavezan.' });
    }
    if (isNaN(bpm) || bpm < 40 || bpm > 300) {
        return res.status(400).json({ error: 'BPM mora biti izmedju 40 i 300.' });
    }
    if (isNaN(godina) || godina < 1500 || godina > new Date().getFullYear()) {
        return res.status(400).json({ error: 'Godina nije ispravna.' });
    }
    if (isNaN(trajanje) || trajanje <= 0) {
        return res.status(400).json({ error: 'Trajanje mora biti pozitivan broj.' });
    }

    const docRef = await db.collection('pjesme').add({
        naziv: naziv.trim(),
        izvodjac: izvodjac?.trim() || '',
        zanr,
        trajanje: +trajanje,
        bpm: +bpm,
        godina: +godina,
        raspolozenje: raspolozenje?.trim() || '',
        userId: req.user.uid,
        kreirano: admin.firestore.FieldValue.serverTimestamp()
    });

    req.status(201).json({ id: docRef.id, message: 'Pjesma dodana.' });
});

app.delete('/api/pjesme/:id', verifyToken, async (req, res) => {
    const docRef = db.collection('pjesme').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        return res.status(404).json({ error: 'Pjesma nije pronadjena.' });
    }
    await docRef.delete();
    res.json({ message: 'Pjesma obrisana.' });
});

app.get('/api/playlist', verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection('playlist')
            .where('userId', '==', req.user.uid)
            .get();

        const stavke = snapshot.docs
        .map((d) => ({id: d.id, ...d.data()}))
        .sort((a, b) => {
            const ta = a.dodano?.seconds ?? 0;
            const tb = b.dodano?.seconds ?? 0;
            return tb - ta;
        });
        res.json(stavke);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/playlist', verifyToken, async (req, res) => {
    const { pjesmaId, naziv } = req.body;
    if (!pjesmaId) {
        return res.status(400).json({ error: 'pjesmaId je obavezan.' });
    }

    const existing = await db.collection('playlist')
        .where('userId', '==', req.user.uid)
        .where('pjesmaId', '==', pjesmaId)
        .get();

    if (!existing.empty) {
        return res.status(409).json({ error: '"$(naziv) je vec na playlisti!' });
    }

    const docRef = await db.collection('playlist').add({
        userId: req.user.uid,
        pjesmaId,
        naziv,
        dodano: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({ id: docRef.id, message: 'Dodano na playlistu.' });
});

app.delete('/api/playlist/:id', verifyToken, async (req, res) => {
    const docRef = db.collection('playlist').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        return res.status(404).json({ error: 'Stavka nije pronadjena.' });
    }
    if (docSnap.data().userId !== req.user.uid) {
        return res.status(403).json({ error: 'Nemate pravo brisanja.' });
    }
    await docRef.delete();
    res.json({ message: 'Uklonjeno s playliste.' });
});

app.listen(PORT, () => {
    console.log(`Server pokrenut na portu ${PORT}`);
});
