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
**Meeting log** tab → **Add meeting log**: pick a date and a title, and edit the content. **The template is pre-filled in the content box** (edit or replace it for each meeting), or drop a `.md/.txt` file onto the box. Everyone can read the log.

**Turn the log into tasks:** keep the table under **Tasks assigned** as it is (columns *Who | Task | Deadline | Event*; Who is a name or email, deadline like `10/12/2026`), then click **Create tasks from "Tasks assigned"**. The multi-task table opens with the rows already filled in so you can check, fix and click **Assign all**. Saving a log never creates tasks by itself; you always confirm first.

## 6. Timeline
**Timeline** tab: add **event markers** (submission deadlines, event days…) with the form at the top. Meetings appear automatically as yellow diamonds.

## 7. Automatic emails
`niffler.hugo@gmail.com` sends, in English:
- To the assignee: when a task has less than 24 hours left and isn't done.
- To all admins: one digest email when tasks are overdue (each task is reported once). Moving the deadline resets it.

See `docs/cai-dat.md` for setup.
