import { initializeApp }
    from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signOut, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';


const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);

async function apiCall(putanja, metoda = 'GET', tijelo = null) {
    const token = await auth.currentUser.getIdToken(false);
    const opcije = {
        method: metoda,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    if (tijelo) opcije.body = JSON.stringify(tijelo);

    let res = await fetch(putanja, opcije);


    if (res.status === 401) {
        const noviToken = await auth.currentUser.getIdToken(true);
        opcije.headers['Authorization'] = `Bearer ${noviToken}`;
        res = await fetch(putanja, opcije);
    }

    return res.json();
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('user-section').style.display  = 'block';
        document.getElementById('user-info').textContent =
            `Prijavljeni ste kao: ${user.email}`;
        ucitajPjesme();
        ucitajPlaylistu();
    } else {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('user-section').style.display  = 'none';
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errEl    = document.getElementById('auth-error');
    errEl.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        errEl.textContent = prevediGresku(err.code);
    }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errEl    = document.getElementById('auth-error');
    errEl.textContent = '';
    if (password.length < 6) {
        errEl.textContent = 'Lozinka mora imati najmanje 6 znakova.';
        return;
    }
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
        errEl.textContent = prevediGresku(err.code);
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

function prevediGresku(kod) {
    const poruke = {
        'auth/user-not-found':   'Korisnik s tim emailom ne postoji.',
        'auth/wrong-password':   'Pogrešna lozinka.',
        'auth/email-already-in-use': 'Email je već registriran.',
        'auth/invalid-email':    'Neispravan email format.',
        'auth/too-many-requests':'Previše pokušaja. Pokušajte kasnije.',
    };
    return poruke[kod] || 'Greška: ' + kod;
}

async function ucitajPjesme(filteri = {}) {
    const tbody = document.getElementById('tbody-pjesme');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Učitavanje...</td></tr>';

    const params = new URLSearchParams();
    Object.entries(filteri).forEach(([k, v]) => { if (v) params.set(k, v); });

    const pjesme = await apiCall('/api/pjesme?' + params.toString());

    if (pjesme.greska) {
        tbody.innerHTML = `<tr><td colspan="8" class="greska-tekst">${pjesme.greska}</td></tr>`;
        return;
    }

    document.getElementById('broj-pjesama').textContent = pjesme.length;
    tbody.innerHTML = '';

    if (pjesme.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="prazno-info">Nema pjesama.</td></tr>';
        return;
    }

    pjesme.forEach(p => {
        const min = Math.floor(p.trajanje / 60);
        const sek = String(p.trajanje % 60).padStart(2, '0');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escHtml(p.naziv)}</strong></td>
            <td>${escHtml(p.izvodjac)}</td>
            <td><span class="badge-zanr">${escHtml(p.zanr)}</span></td>
            <td>${min}:${sek}</td>
            <td>${p.bpm} BPM</td>
            <td>${p.godina}</td>
            <td>${escHtml(p.raspolozenje || '–')}</td>
            <td class="akcije">
                <button class="btn-playlist" data-id="${p.id}" data-naziv="${escHtml(p.naziv)}">
                    + Playlista
                </button>
                <button class="btn-obrisi" data-id="${p.id}">🗑</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-playlist').forEach(btn => {
        btn.addEventListener('click', () =>
            dodajNaPlaylistu(btn.dataset.id, btn.dataset.naziv));
    });
    document.querySelectorAll('.btn-obrisi').forEach(btn => {
        btn.addEventListener('click', () => obrisiPjesmu(btn.dataset.id));
    });
}

document.getElementById('btn-dodaj-pjesmu').addEventListener('click', async () => {
    const errEl = document.getElementById('forma-greska');
    errEl.textContent = '';

    const tijelo = {
        naziv:        document.getElementById('naziv').value.trim(),
        izvodjac:     document.getElementById('izvodjac').value.trim(),
        zanr:         document.getElementById('zanr').value,
        trajanje:     +document.getElementById('trajanje').value,
        bpm:          +document.getElementById('bpm').value,
        godina:       +document.getElementById('godina').value,
        raspolozenje: document.getElementById('raspolozenje').value.trim()
    };

    if (!tijelo.naziv)   { errEl.textContent = 'Naziv je obavezan.'; return; }
    if (!tijelo.zanr)    { errEl.textContent = 'Odaberi žanr.'; return; }
    if (!tijelo.trajanje){ errEl.textContent = 'Unesite trajanje.'; return; }
    if (tijelo.bpm < 40 || tijelo.bpm > 300) {
        errEl.textContent = 'BPM mora biti između 40 i 300.'; return;
    }
    if (tijelo.godina < 1900 || tijelo.godina > new Date().getFullYear()) {
        errEl.textContent = 'Neispravna godina.'; return;
    }

    const res = await apiCall('/api/pjesme', 'POST', tijelo);
    if (res.greska) { errEl.textContent = res.greska; return; }


    ['naziv','izvodjac','trajanje','bpm','godina','raspolozenje'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('zanr').value = '';

    ucitajPjesme();
});

async function obrisiPjesmu(id) {
    if (!confirm('Sigurno želite obrisati ovu pjesmu?')) return;
    const res = await apiCall(`/api/pjesme/${id}`, 'DELETE');
    if (res.greska) { alert(res.greska); return; }
    ucitajPjesme();
}

document.getElementById('btn-filtriraj').addEventListener('click', () => {
    ucitajPjesme({
        izvodjac:     document.getElementById('filter-izvodjac').value.trim(),
        zanr:         document.getElementById('filter-zanr').value,
        raspolozenje: document.getElementById('filter-raspolozenje').value.trim(),
        bpm_min:      document.getElementById('filter-bpm-min').value,
        bpm_max:      document.getElementById('filter-bpm-max').value,
        godina_min:   document.getElementById('filter-godina-min').value,
        godina_max:   document.getElementById('filter-godina-max').value,
    });
});

document.getElementById('btn-reset').addEventListener('click', () => {
    ['filter-izvodjac','filter-raspolozenje',
     'filter-bpm-min','filter-bpm-max',
     'filter-godina-min','filter-godina-max'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('filter-zanr').value = '';
    ucitajPjesme();
});

async function ucitajPlaylistu() {
    const lista   = document.getElementById('lista-playlista');
    const prazna  = document.getElementById('playlista-prazna');
    const badge   = document.getElementById('broj-playlista');

    const stavke = await apiCall('/api/playlist');
    lista.innerHTML = '';

    if (!stavke || stavke.greska || stavke.length === 0) {
        prazna.style.display = 'block';
        badge.textContent = '0';
        return;
    }

    prazna.style.display = 'none';
    badge.textContent = stavke.length;

    stavke.forEach(stavka => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>🎵 ${escHtml(stavka.naziv)}</span>
            <button class="btn-ukloni" data-id="${stavka.id}">Ukloni</button>
        `;
        lista.appendChild(li);
    });

    document.querySelectorAll('.btn-ukloni').forEach(btn => {
        btn.addEventListener('click', () => ukloniSPlayliste(btn.dataset.id));
    });
}

async function dodajNaPlaylistu(pjesmaId, naziv) {
    const res = await apiCall('/api/playlist', 'POST', { pjesmaId, naziv });
    if (res.greska) {
        alert(res.greska);
        return;
    }
    alert(`"${naziv}" dodano na playlistu!`);
    ucitajPlaylistu();
}

async function ukloniSPlayliste(id) {
    const res = await apiCall(`/api/playlist/${id}`, 'DELETE');
    if (res.greska) { alert(res.greska); return; }
    ucitajPlaylistu();
}

function escHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}
