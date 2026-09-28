# Set up Estudio Personal with GitHub only (no NAS, no server)

When you're done you'll have:

- **The app** at `https://<your-user>.github.io/Personal-Bible-Study/`. It's free, it's always online, and you can install it on your phone and computer.
- **Your notes** in a **private** repository called `estudio-notas`. Only you can see it. Every save is a commit, so GitHub keeps the full history.
- **Offline use.** Each device keeps its own copy. You can write with no internet, and the changes upload automatically when you're back online.

The steps below take about 10 minutes. Everything happens on github.com.

---

## 1. Create the private repository for your notes

1. Go to **https://github.com/new**.
2. Repository name: `estudio-notas`
3. Choose **Private**.
4. Click **Create repository**. Leave it empty; the app fills it in.

## 2. Create the app's access token (its "key" to your notes)

1. Go to **https://github.com/settings/personal-access-tokens/new**. To get there by clicking: your photo (top right) → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name:** `Estudio Personal`
3. **Expiration:** choose the longest option offered. When it expires, the app shows **"Revisa el token"**; you create a new token and paste it in, and nothing is lost.
4. **Repository access:** choose **Only select repositories** → **`estudio-notas`**.
5. **Permissions → Repository permissions → Contents:** set it to **Read and write**.
6. Click **Generate token**. Copy the token, which starts with `github_pat_…`, and keep it somewhere safe, such as your password manager. GitHub won't show it again.

> The token is stored only on the devices where you paste it. Don't share it with anyone.

## 3. Turn on GitHub Pages (one time)

1. In the `Personal-Bible-Study` repository, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose **main** and the folder **/ (root)**, then click **Save**.
4. Wait about 1–2 minutes. The app is then live at `https://<your-user>.github.io/Personal-Bible-Study/`, which opens `…/public/` automatically.

## 4. Open the app, connect, and import your notes

1. Open `https://<your-user>.github.io/Personal-Bible-Study/` on your computer.
2. Paste your **token**. The notes repository field is already filled in as `<your-user>/estudio-notas`. Click **Conectar**.
3. Load your existing notes: click **Ajustes** (the sliders icon, top right) → **Importar copia** → choose the file **`mis-apuntes.json`**. This imports all your notes and quiz questions and saves them to `estudio-notas`. The indicator at the top shows **Sincronizado** when it's done.

> For privacy, your notes are **not** in the public `Personal-Bible-Study` repository. They only ever go to your private `estudio-notas`.

## 5. Install it on your phone and computer

- **iPhone/iPad (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** ⋮ menu → **Install app**.
- **Windows/Mac (Chrome or Edge):** the install icon in the address bar.

On each new device, open the app once with internet and paste the same token. It downloads your notes, and after that it opens and works even with no connection.

---

## Daily use

| Indicator at the top | What it means |
| --- | --- |
| **Sincronizado** | Everything is saved on GitHub. |
| **Sincronizando…** | Uploading or downloading changes. |
| **Sin conexión · N pendientes** | You're offline. Keep writing; it uploads when you're back online. |
| **Revisa el token** | The token expired or was deleted. Tap the indicator and paste a new one. |
| **Solo en este dispositivo** | This device isn't connected to GitHub. Tap the indicator to connect. |

- **Edited the same note on two devices?** Nothing is lost. The newest version stays, and the other one is saved as a copy with **"(conflicto)"** in its title. Monthly Daily Text documents are merged day by day automatically.
- **Backups:** every sync is a commit in `estudio-notas`, so you can open any file's **History** on GitHub to recover an old version. You can also go to **Ajustes → Exportar copia** to download everything as one file, and use **Importar copia** to load it back.
- **AI:** the app works without a key using the built-in engine. For better quiz questions and proofreading, add a free Google Gemini key in **Ajustes**. It's saved only on that device.
- **Bible verses offline (Versículo button):** download the New World Translation as **EPUB** from jw.org (Spanish `nwt_S.epub` and/or English `nwt_E.epub`). In the app, go to **Ajustes → Biblia sin conexión → Importar Biblia (EPUB)** and choose both files. This takes about 10 seconds and is needed once per device. The Bible is stored **only on that device**; it is never uploaded to GitHub. Then select a citation in a note, such as `Juan 3:16`, `Prov. 3:5, 6`, `Rom. 5:12; 6:23` or `1 Cor. 13:4-8`, and press **Versículo**. The text is inserted even with no internet.
  - The language follows the book name: `Juan`/`Proverbios` insert Spanish, and `John`/`Proverbs` insert English.
  - Abbreviations that are the same in both languages, such as `Prov.` or `Rom.`, follow the language of the note. You can also fix the language in Ajustes (**Idioma de los versículos**).
- **Updating the app later:** any change pushed to `Personal-Bible-Study` is republished automatically. Your notes aren't touched.
