# Cornell Maker Club website

A plain HTML site for GitHub Pages: no WordPress, no build step, no framework. It uses the Modernist look from the redesign (Archivo, red on off-white, 2px rules, square corners, grayscale photos).

## Pages

Each page is the `index.html` inside a folder named after its address. The addresses match the old WordPress site, so old links keep working if the club's domain is pointed here.

| Page | Address |
|---|---|
| Home | `/` |
| Join | `/join/` |
| Resources | `/resources/` |
| Team Finder | `/team-finder/` |
| Make-a-thon (includes the photo gallery) | `/make-a-thon/` |
| Projects | `/project-videos-and-demos/` |
| Safety | `/safety/` |
| Contact (with the e-board) | `/contact/` |
| Lab Forms and Information | `/lab-forms-and-information/` |
| Part Ordering (includes approved vendors) | `/partordering/` |
| Project Storage | `/project-storage/` |
| Project Help | `/project-help/` |
| Workshops | `/workshops/` |
| Maintenance Request | `/maintenance-request/` |
| Online PCB Seminar | `/online-pcb-seminar/` |
| Project Documentation | `/project-docs/` |
| Not found | `404.html`, shown for any missing page |

`/gallery/` and `/projects/e-shop-approved-vendors/` forward to the sections that replaced them.

Photos live in `assets/img/`, and e-board headshots in `assets/img/team/` (named `first-last.jpg`). To change the e-board each semester, swap the headshots and edit the names on the Contact page.

Shared files are in `assets/`:
- `modernist.css`: the design system's colors, type and buttons. Don't edit this one unless you're changing the whole look.
- `site.css`: page basics and hover states.
- `site.js`: site search and the footer year.
- `config.js`: the Team Finder backend address.
- `team-finder.js`: the Team Finder form and board.

All links between pages are relative, so the site works at `username.github.io/repo-name/` and on a custom domain.

## Put it on GitHub Pages

1. Create a GitHub repository (for example `makerclub`) and upload everything in this folder, including the hidden `.nojekyll` file.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose `main` and `/ (root)`, then click **Save**.
4. After about a minute the site is live at `https://YOUR-GITHUB-NAME.github.io/makerclub/`.

To use a custom domain (like `makerclub.ece.cornell.edu`), enter it under **Settings → Pages → Custom domain**, then ask whoever manages the domain's DNS to point a CNAME record at `YOUR-GITHUB-NAME.github.io`.

## Training sign-up setup

The Join page's **Training** section loads the session list and sign-up form from the training Apps Script (its URL is in `data-endpoint` on the `cmc-trainings` box in `join/index.html`).

1. Copy `trainings/site/trainings.js` from the `Cornell-Maker-Club/cmc` repository into this site's `join/` folder, next to `join/index.html`. Until it's there, the Training section shows its text but no sessions.
2. To email a confirmation and a Google Calendar invite to everyone who signs up, add `google/training-confirmations.gs` to the training Apps Script project:
   - In the script editor, click **+ → Script**, name it `training-confirmations`, and paste in the file.
   - Click **Services (+)**, add **Google Calendar API**, and click **Add**.
   - In your sign-up handler, right after a sign-up is saved, call `sendTrainingConfirmation_({ name, netid, training, start, end, location, trainer })` (the file's header shows an example).
   - Set `SITE_URL` near the top to your Join page. Run `testTrainingConfirmation` once with your own NetID to approve permissions and check the email and invite. The account that deploys the script needs permission to edit the Training calendar ("Make changes to events" in its sharing settings).
   - Deploy a new version (**Deploy → Manage deployments → Edit → New version**) so the URL stays the same.
3. Emails and invites come from whichever account deploys the script. To send them from **cornellmakerclub@gmail.com**, the script must be owned and deployed by that account.

The invite adds each person as a guest on that session's event on the club's Training calendar (creating the event the first time someone signs up). Guests can't see each other's emails. If your sessions are already events on that calendar under a different title, change the `title` line in `sendTrainingConfirmation_` to match them so people are added to the existing event.

## Team Finder setup

GitHub Pages can only host static files, so the Team Finder stores posts in a Google Sheet through a small Google Apps Script. It takes about 10 minutes. Use the club's shared Google account, because emails are sent from whichever account deploys the script.

1. Create a Google Sheet named **Maker Club Team Finder** and open **Extensions → Apps Script**.
2. Delete the starter code and paste in everything from `google/Code.gs`. (The old `Index.html` file from the WordPress version isn't needed any more.)
3. At the top, set:
   - `ADMIN_EMAIL`: the address that should hear about new posts.
   - `SITE_URL`: the address of your Team Finder page, for example `https://YOUR-GITHUB-NAME.github.io/makerclub/team-finder/`.
   - `REQUIRE_APPROVAL`: `true` if officers should approve posts before they go live.
4. Save. Pick `setup` in the function menu and click **Run**. Approve the permissions (Sheets and sending email).
5. Click **Deploy → New deployment**, then the gear icon → **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. In this repository, open `assets/config.js`, paste the URL between the quotes after `teamFinderEndpoint:`, and commit.

Until step 6 is done, the Team Finder runs in **preview mode**: it works, but posts are saved only in the visitor's own browser, and the page says so.

How it works:
- **Posting:** the post is saved as `unverified` and a confirmation email goes to `netid@cornell.edu`, so only the real owner of that NetID can publish it.
- **Confirming:** the link in that email publishes the post (or marks it `pending` if approval is on) and emails the admin.
- **"I'm interested":** the message is emailed to the poster, with the sender copied and set as reply-to. Each message is logged in the **Interest** tab.
- **Removing:** posters use the "Remove my post" link in their confirmation email. Admins set the post's `status` to `removed` in the sheet.
- **Approving (if on):** change `status` from `pending` to `open`.

After editing `Code.gs`, go to **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same. Apps Script on Cornell's Google Workspace can send about 1,500 emails a day, and each NetID can have 3 active posts.

## Things to know

- **Files still on the old WordPress site:** the three photos on Home and Resources, the PCB seminar slides, and the "Flower Awakens" video on Projects. If the WordPress site is shut down, those will break. Download them into `assets/` and update the links. The Cornell logo also loads from Wikimedia; swap in a Cornell-approved file.
- **Project Documentation** (`/project-docs/`) links to two template repositories, `Cornell-Maker-Club/project-template-simple` and `Cornell-Maker-Club/project-template-custom`. Create them from `project-templates.zip` (see its README) so the page's buttons work.
- **Search** sends the query to Google, limited to this site. New pages take a few days to appear in Google.
- **Editing text:** open the page's `index.html` on GitHub, click the pencil icon, change the text between the tags and commit. The header and footer are repeated on each page, so change a nav link in all five HTML files.
