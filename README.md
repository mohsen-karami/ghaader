# Ghaader

> **قادر** *(Ghaader)* — Persian for "able", "capable", "empowered"
>
> Also stands for: **G**it**H**ub **A**s **A** **D**ownload**ER**

---

## Why Ghaader Exists

Iran is going through recurring internet blackouts that severely restrict access to the open internet. During these periods, only a handful of services remain accessible — notably Google and GitHub. While there are ways to bypass the restrictions, they are prohibitively expensive and impractical for downloading files.

Ghaader was born out of this reality. It **enables** downloading files from the internet by turning GitHub into a file download proxy — leveraging GitHub's free webhook and API features. You post a URL (or multiple URLs) in a GitHub Issue, and Ghaader downloads those files from the open internet on your behalf, then uploads them directly to your repository — ready for you to download from GitHub's accessible infrastructure.

> No paid GitHub features are required. Webhooks and the GitHub API are completely free for both public and private repositories.

---

## How It Works

```
You create an issue ──→ Ghaader downloads the file ──→ File appears in your repo
```

1. Create an issue in your repository containing one or more URLs
2. Ghaader receives the webhook event on your server
3. It downloads each file from the provided URLs
4. Files are committed to the repository and linked in the issue comments
5. If a file exceeds 95MB, it is split into multi-part 7z archives
6. The issue is labeled based on the outcome and closed automatically

### YouTube Support

For YouTube links, Ghaader uses `yt-dlp` to download the video. Specify your desired quality in the issue title:

| Issue Title | Result |
|-------------|--------|
| `720p` | Downloads at 720p |
| `1080p` | Downloads at 1080p |
| `4k` | Downloads at 4K (2160p) |
| *(no quality specified)* | Defaults to 720p |

If the requested quality is unavailable, the highest available quality is downloaded.

### Outcome Labels

| Label | Meaning |
|-------|---------|
| `completed` | All URLs downloaded and uploaded successfully |
| `partial` | Some URLs succeeded, others failed (details in comments) |
| `failed` | All URLs failed to download (reasons listed in comments) |

### Extracting Split Files

Files larger than 95MB are split into multi-part 7z archives (`.7z.001`, `.7z.002`, ...). To reassemble:

- **Windows/Mac:** Open the first part (`.7z.001`) with [7-Zip](https://www.7-zip.org/) or WinRAR — all parts are joined automatically
- **Linux:** `7z x filename.7z.001`

---

## For Iranians Abroad

If you are an Iranian living outside of Iran, you can set up a Ghaader instance on a server with unrestricted internet access and share it with your family and friends back home. They only need to be added as collaborators to your repository — no VPN, no expensive workaround. Just create an issue with a link, and the file appears ready to download.

**This is one of the most practical ways you can help people back home access the files they need during blackouts.**

---

## Fork & Run Your Own Instance

Anyone can deploy their own Ghaader instance. You do not need to pay GitHub for any features used by this app.

### Prerequisites

| Dependency | Purpose | Install |
|-----------|---------|---------|
| Node.js 22+ | Runtime | [nodejs.org](https://nodejs.org/) |
| PM2 | Process manager | `npm install -g pm2` |
| p7zip-full | Splitting large files | `sudo apt install p7zip-full` |
| yt-dlp | YouTube downloads | [yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases) |
| ffmpeg | Best YouTube quality | `sudo apt install ffmpeg` |

> Without ffmpeg, YouTube downloads still work but are limited to single-stream formats (usually lower quality).

### Setup

1. **Fork this repository** — making it private is optional but strongly recommended if you want to restrict who can submit download requests

2. **Add collaborators** who should be able to submit download requests via issues

3. **Generate a GitHub Personal Access Token (PAT):**
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Select your forked repository
   - Grant permissions: Issues (Read & Write), Contents (Read & Write)

4. **Configure a GitHub Webhook:**
   - Go to your forked repo → Settings → Webhooks → Add webhook
   - Payload URL: `http://<your-server-ip>:<port>/webhooks/github`
   - Content type: `application/json`
   - Secret: choose a strong secret (you will need this in your ecosystem config)
   - Events: select **"Issues"** only

5. **Deploy on your server:**
   ```bash
   # Clone using HTTPS with your token (required for automated git push)
   git clone https://<YOUR_TOKEN>@github.com/<you>/<your-fork>.git
   cd <your-fork>
   git config user.name "Your Name"
   git config user.email "your@email.com"
   npm install
   # Edit ecosystem.config.cjs with your values (see Configuration below)
   pm2 start ecosystem.config.cjs
   ```

> **Important:** Clone using HTTPS with your PAT embedded in the URL. SSH keys with passphrases will cause the app to hang on push. The HTTPS + token approach requires no interaction and works reliably for automated services.

### Configuration

Edit the `env` object in `ecosystem.config.cjs` with your values:

| Variable | Required | Description |
|----------|:--------:|-------------|
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token with repo permissions |
| `WEBHOOK_SECRET` | Yes | The secret you set when configuring the webhook |
| `REPO_PATH` | Yes | Absolute path to the cloned repository on the server |
| `PORT` | No | Server port (default: `3000`) |
| `MAX_FILE_SIZE_MB` | No | Max file size before splitting (default: `95`) |
| `LOG_LEVEL` | No | Logging level: error, warn, info, debug (default: `info`) |
| `YOUTUBE_COOKIES_PATH` | No | Path to cookies.txt for YouTube downloads |

---

## YouTube Cookies Setup

YouTube blocks automated downloads unless you authenticate. You need to export cookies from a browser where you're logged into YouTube and place the file on your server.

1. On your **desktop/laptop**, install a browser extension to export cookies:
   - Chrome: "Get cookies.txt LOCALLY"
   - Firefox: "cookies.txt"
2. Log into YouTube in your browser
3. Navigate to youtube.com, then use the extension to export cookies — save as `cookies.txt`
4. Upload the file to your server:
   ```bash
   scp cookies.txt user@your-server-ip:/path/to/ghaader/cookies.txt
   ```
5. Set the path in your ecosystem config:
   ```
   YOUTUBE_COOKIES_PATH: '/path/to/ghaader/cookies.txt'
   ```
6. Restart the app: `pm2 restart ghaader`

> **Note:** Cookies expire over time (usually every few months). If YouTube downloads start failing again, repeat steps 2–6 with fresh cookies.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 22+ (LTS) |
| Framework | Express.js |
| GitHub Integration | @octokit/rest |
| File Processing | 7z (p7zip-full) |
| Logging | Winston with daily rotation |
| Process Manager | PM2 |
| YouTube Downloads | yt-dlp |
| Architecture | Class-based layered with DI |

## Project Structure

```
src/
├── config/              # Environment config, DI container
├── controllers/         # HTTP request handling
├── services/            # Business logic (download, file processing, GitHub API)
├── middleware/          # Webhook signature verification
├── utils/               # Logger, processing queue
└── app.js               # Application entry point
```

---

## Development

**Production:**
```bash
npm install
pm2 start ecosystem.config.cjs
```

**Development (auto-restart):**
```bash
cp .env.example .env
# Edit .env with your actual values
npm run dev
```

---

## Spread the Word

If you find Ghaader useful, please help others discover it:

- **Star** this repository to increase its visibility
- **Share** it with friends and family who might benefit
- **Introduce** it to communities where people struggle with internet restrictions

The more people know about Ghaader, the more people can access the files they need during blackouts. Every share counts.

---

## License

GPL-3.0 — see [LICENSE](LICENSE) for details.
