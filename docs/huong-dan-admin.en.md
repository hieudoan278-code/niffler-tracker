# Admin guide

## 1. Adding members
**Members** tab → enter the member's **Google email** and a role → **Add**. No name needed: they set their own name on first sign-in (and can change it with **Rename** in the top-right corner). Admins can rename anyone with the **Rename** button at the end of each row. Only emails on the list can sign in. The "Signed in" column shows who has logged in.

**Roles:** only the account `niffler.hugo@gmail.com` can change roles (Admin / Member) and add new admins. Other admins can only add members.

## 2. Bulk-assigning tasks with one CSV file
1. **Templates** tab → download `mau-phan-cong.csv`.
2. Open it in Excel or Google Sheets, one task per row, **keep the first row**:

| Column | Required | Example |
|---|---|---|
| `email` | Yes | `lan@gmail.com` (must be in the Members tab) |
| `title` | Yes | `Design the poster` (max 200 characters) |
| `deadline` | Yes | `2026-12-05 23:59` or `05/12/2026` (no time means 23:59) |
| `description` | No | A short description |
| `event` | No | `Hugo Cup` (event name, created automatically if new) |

3. Save as **CSV** (Excel: *Save As → CSV UTF-8*; Google Sheets: *Download → CSV*). Use UTF-8 so accents are not garbled. Both `,` and `;` separators work.
4. On the **Task board**, drop the file into the **Bulk assign** box (or click Choose CSV file).
5. Read the **Preview** table. Red rows have errors and are skipped: unknown email, wrong date, deadline in the past, duplicate task. Click **Assign N valid tasks**.

Each task lands in the **To do** column of the person with that email.

## 3. Assigning a single task
Two ways, drag-and-drop is optional:
- Click **+ Add task** (top of the page, or on a person's row) → choose the person, fill in the task name, deadline, description, optional attachment and event → **Assign task**.
- Or drop any file (brief, instructions… except `.csv`) onto **a person's row**; the form opens with that file already attached.

## 4. Following progress
- A red banner at the top of the Task board lists **overdue** tasks.
- Click a card to see comments, history and the proof file. Admins can move the deadline, change the event or delete the task in that panel (delete needs two clicks).
- Admins can drag anyone's cards, including to Done once proof exists.

## 4b. Events and completing an event
Each task can belong to an **event** (choose one or type a new name when assigning, or use the `event` column in the CSV). Cards show the event name and the Task board has an event filter, so even if one person runs several events you can tell which task belongs to which. Admins change a task's event in its side panel.

**Events** tab → **Complete event** (click twice; all of the event's tasks must be Done). Its tasks disappear from the board but stay in the database. Within about an hour the system creates a Google Doc log (tasks, assignees, deadlines, completion dates, proof paths, comments) in the Drive folder **"Niffler - Event logs"** of `niffler.hugo@gmail.com`, and the link appears in the Events tab. The **Delete** button removes an event together with its tasks (the Drive log is kept).

## 5. Meeting log
**Meeting log** tab → **Add meeting log**: pick a date, a title, paste the notes (Markdown) or drop a `.md/.txt` file. A template is in the Templates tab. Everyone can read it.

## 6. Timeline
**Timeline** tab: add **event markers** (submission deadlines, event days…) with the form at the top. Meetings appear automatically as yellow diamonds.

## 7. Automatic emails
`niffler.hugo@gmail.com` sends, in English:
- To the assignee: when a task has less than 24 hours left and isn't done.
- To all admins: one digest email when tasks are overdue (each task is reported once). Moving the deadline resets it.

See `docs/cai-dat.md` for setup.
