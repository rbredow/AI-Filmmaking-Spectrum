# Project Plan: Real-Time AI Filmmaking Spectrum

## 1. Project Overview

A web-based interactive graph where ~200 concurrent users can vote on the "Utility" vs. "Readiness" of AI tools in filmmaking. A single "Master" view visualizes the aggregate data (consensus) in real-time.

## 2. User Experience (UX)

### The "Voter" (Audience)

* **Access:** Scans a QR code or hits a URL. No login required (Anonymous).
* **View:** Sees the graph populated with current tools.
* **Interaction:**
* Drags a dot to where *they* believe it belongs.
* Visual feedback: The dot stays where they put it (their personal vote).
* Optional: A "ghost" dot shows the group average (if we want to influence them) or we keep it blind (to get honest raw data).


* **Contribution:** Clicks a floating "+" button to suggest a new tool (e.g., "Runway Gen-3").

### The "Master" (Presenter)

* **Access:** Same URL but with a query parameter (e.g., `?admin=true`) or a hidden toggle.
* **View:** Sees the "Official" graph.
* **Logic:** The position of every dot is not static; it is the mathematical average of all active user votes in the database.
* **Administration:**
* Sidebar shows "Proposed Tools" from the audience.
* One-click "Approve" adds the tool to the live graph for everyone.
* One-click "Reset" (optional) to clear outliers.



---

## 3. Technical Architecture

* **Frontend:** Vanilla HTML5 / CSS3 / ES6 Javascript.
* *Why:* Lightweight, no build step (Webpack/React) needed for a single file app, easy to edit via LLM.


* **Backend:** Google Firebase Realtime Database (RTDB).
* *Why:* WebSocket-based, handles hundreds of concurrent connections easily, sends JSON updates instantly.


* **Auth:** Firebase Anonymous Auth.
* *Why:* We need a User ID (`uid`) to track unique votes, but we don't want users to type emails/passwords.


* **Hosting:** Firebase Hosting or GitHub Pages.

---

## 4. Data Structure (Schema)

This is the most critical part for your implementation. We will use a "normalized" structure to prevent write conflicts.

```json
{
  "project_id": {
    // 1. THE DEFINITIVE LIST OF TOOLS
    "items": {
      "item_001": { "name": "Sora", "description": "Text to video...", "category": "gen" },
      "item_002": { "name": "Denoising", "description": "Cleanup...", "category": "util" }
    },

    // 2. THE VOTES (Separated by Item -> User)
    // This allows 200 people to write simultaneously without locking the DB.
    "votes": {
      "item_001": {
        "user_A_uid": { "x": 90, "y": 20 },
        "user_B_uid": { "x": 85, "y": 25 }
      },
      "item_002": {
        "user_A_uid": { "x": 5, "y": 95 }
      }
    },

    // 3. PROPOSALS (The Inbox)
    "proposals": {
      "prop_xyz": { "name": "ChatGPT Scripting", "user": "user_C_uid" }
    }
  }
}

```

---

## 5. Implementation Stages

### Phase 1: Environment & Static Base

* Initialize Git Repo.
* Create `index.html` (The code we just perfected).
* Create `style.css` (Extract the CSS for cleaner management).
* Create `app.js` (Extract the JS).
* **Milestone:** A working local version of the static graph.

### Phase 2: Firebase Connection

* Create Firebase Project in Console.
* Enable **Anonymous Auth**.
* Create **Realtime Database**.
* *Rules:* Set `.read` to true for everyone. Set `.write` to true (we will refine this later to prevent vandalism if needed).


* Add Firebase SDK via CDN links in `index.html`.
* **Milestone:** Console logs show "Connected to Firebase" and a generated User ID.

### Phase 3: The "Voter" Logic

* Modify `app.js` to distinguish `myVote`.
* **On Drag End:** Trigger function `submitVote(itemId, newX, newY)`.
* **DB Action:** `firebase.database().ref('votes/' + itemId + '/' + myUid).set({x, y})`.
* **Milestone:** Dragging a dot creates an entry in the Firebase Console dashboard.

### Phase 4: The "Master" Logic

* Create `admin.js` (or handle via flags in `app.js`).
* **Listener:** `firebase.database().ref('votes').on('value', snapshot => ...)`
* **The Math:**
1. Loop through every Item ID.
2. Loop through every User ID inside that item.
3. Sum X and Sum Y.
4. `AvgX = SumX / Count`.
5. Update the DOM position of the dot.


* **Milestone:** Opening two browser windows; dragging in Window A moves the dot in Window B (the Master).

### Phase 5: The Proposal System

* Add UI: Simple input field + "Suggest" button for users.
* Add Admin UI: A hidden div that appears if `?admin=true` showing the list.
* **Logic:** Admin click "Approve" -> Pushes new entry to `items` node -> Clears proposal.

---

## 6. Development Prompt Strategy

Since you are moving to a CLI LLM, here is how you should feed this to the AI to get the best code generation.

**Prompt for your CLI Session:**

> "I have a project structure with index.html, style.css, and app.js.
> I want to integrate Firebase Realtime Database.
> **Context:**
> 1. We are building a voting graph for 200 users.
> 2. Users are anonymous.
> 3. Data structure: `votes/{itemId}/{userId} = {x, y}`.
> 
> 
> **Task:**
> Please rewrite `app.js`. It needs to check if the user is an Admin or a Voter (check URL params).
> If Voter: Dragging a dot updates their specific node in Firebase.
> If Admin: Listen to all nodes, calculate the average X/Y for each item, and update the UI live.
> Use the standard Firebase Web SDK CDN."

---
