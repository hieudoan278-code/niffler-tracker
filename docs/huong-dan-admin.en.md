# Admin guide

## 1. Adding members
**Members** tab → enter the member's **Google email** and a role → **Add**. No name needed: they set their own name on first sign-in (and can change it with **Rename** in the top-right corner). Admins can rename anyone with the **Rename** button at the end of each row. Only emails on the list can sign in. The "Signed in" column shows who has logged in.

**Roles:** only the account `niffler.hugo@gmail.com` can change roles (Admin / Member) and add new admins. Other admins can only add members.

## 2. Assigning several tasks at once
On the **Task board**, click **Assign several tasks** to open the entry table: each row is one task with the assignee (pick from the list), task name, deadline, event (pick or type a new one) and description. **+ Add row** adds a row, **×** deletes it, empty rows are ignored.

**Paste from Excel / Google Sheets:** open *Paste from Excel / Google Sheets*, paste the copied cells (columns in this order: assignee (email or name), task, deadline, event, description) and click **Fill the table**. Write the deadline as `2026-12-05 23:59` or `05/12/2026` (no time means 23:59). Rows with problems (no assignee, deadline in the past, duplicate…) turn red with the reason; fix them and click **Assign all**.

**Import from a CSV file (secondary):** click **Import CSV** or drop the file onto the box. The template is in the **Templates** tab (`mau-phan-cong.csv`, columns `email,title,deadline,description,event`; save as *CSV UTF-8*). A preview is shown and rows with errors are skipped.

Each task lands in the **To do** column of its assignee.

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
**Meeting log** tab → **Add meeting log** is a Notion-style editor: pick a date and title, then write directly (the template is pre-filled; edit or clear it for each meeting). You can also drop a `.md/.txt` file onto it. The toolbar has **B** (bold, Ctrl+B), **I** (italic, Ctrl+I), **H** (heading), **•** (bullet) and **+ Assign task**.

**"/" commands:** type `/` on an empty line and a menu appears at the cursor; ↑/↓ to choose, Enter or Tab to insert, Esc to close.
- `/task` inserts a **task card** (assignee, task, deadline, event). Type a few letters in the assignee box to get member suggestions (accents optional).
- `/decision`, `/carry`, `/note` add a bullet to Decisions, Carried over, Other notes (the section is created if missing).
- `/h` heading, `/present` Present / Absent lines, `/date` today's date.

**Saving the log assigns the tasks.** The save button tells you in advance how many tasks it will create ("Save log and assign 3 tasks"). Every card is checked like the multi-task table (assignee chosen, deadline not past, no duplicate…); if any card has a problem, **nothing is saved** and that card shows red text. Created tasks can't be undone, so read carefully before clicking. Empty cards are ignored.

**Editing a saved log:** click **Edit** on the log. Every change is saved block by block; click **Done** to create tasks for new cards (assigned cards show "Assigned" with an Open task button) and refresh the version everyone reads, or **Close** to only refresh the readable version. Deleting a card in the log does not delete the task (delete it on the Task board). Old logs without blocks are converted automatically the first time they are edited.

**Several admins editing one log:** a block someone is typing in shows "<name> is editing" and is read-only for the others; two people can edit two different blocks at the same time and changes appear on the other side right away. The top of the log shows "Editing now: …". If someone closes the tab mid-edit, the lock is released after about 30 seconds. It is not character-by-character co-typing inside the same block.

## 6. Timeline
**Timeline** tab: add **event markers** (submission deadlines, event days…) with the form at the top. Meetings appear automatically as yellow diamonds.

## 7. Automatic emails
`niffler.hugo@gmail.com` sends, in English:
- To the assignee: when a task has less than 24 hours left and isn't done (checked hourly).
- To all admins: **within about 1 minute after a task becomes overdue** (checked every minute), as one digest if several tasks become overdue together; each task is reported once, and moving the deadline resets it.
- The Drive event log is created within about 1 minute after you click Complete event.
- **No email is sent when a task is assigned** (on purpose, so a mistaken assignment doesn't cause confusion; the assignee sees the task on the Task board right away).

See `docs/cai-dat.md` for setup.
