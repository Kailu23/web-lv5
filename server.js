const express = require('express');
const fs = require('fs')
const path = require('path')
const PORT = process.env.PORT || 3000;

const app = express();
app.set("view engine", "ejs")
app.use(express.static('public')); // "posluzuje" index.html

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
