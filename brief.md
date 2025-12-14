Project Brief: Break Planner MVP

Problem:
Retail managers spend time every day manually planning and staggering employee breaks while trying to maintain minimum floor coverage and comply with break rules. This is repetitive, error-prone, and hard to adjust when the day changes (late arrivals, call-outs, rushes)..


Goal
Create an MVP that lets a manager input shifts + rules, generate an optimized break schedule automatically, visualize it clearly, and adjust it quickly without breaking coverage or policy constraints.


Core outcomes
	•	Reduce time to create a daily break plan
	•	Reduce break/coverage mistakes
	•	Make break plan easy to communicate and adjust


MVP Scope

1) Employee + shift setup

Functions
	•	Add employees for the day
	•	Add each employee’s shift start/end time
	•	Assign role/skill tags (minimum needed for coverage constraints), specifically.:
	•	Lead
	•	Product Guide
	•	Manager

UX requirements
	•	Fast entry: add row, duplicate row, copy yesterday (if you include this)
	•	Time inputs should support quick editing (dropdowns or typed HH:MM)


  2) Parameters setup (Rules + Coverage)

This is the “parametric engine” UI. Managers should be able to configure the store’s break policy once and reuse it daily.

Break Rules (by shift length)

Provide the ability to define break rules by shift length. 
Examples:
	•	If shift is ≤ 5h → 1 × 15 min
	•	If shift is > 5h and ≤ 7h → 1 × 15 + 1 × 30 lunch
	•	If shift is > 7h → 2 × 15 + 1 × 30 lunch

Rule configuration requirements
	•	 Definebreak types: (Paid 15, Meal 30, etc.)
	•	Define lunch window constraints (e.g., lunch must happen between hour 3 and 5 of shift)
	•	Define earliest/latest break start times (optional but helpful)

Coverage Rules

Coverage rules must be configurable in a simple way:
	•	Minimum total staff on floor per time block (e.g., “At least 3 active staff at all times”)
	•	Minimum per role (e.g., “At least 1 cashier at all times”)
	•	Role protection constraints:
	•	“Never send both keyholders on break simultaneously”
	•	“Always keep at least 1 Lead available” (if applicable)

Time granularity
	•	Choose scheduling increments (default 15 minutes)

3) Generate schedule

Functions
	•	A Generate button produces a break schedule that:
	•	Fits each employee’s break entitlements
	•	Staggers breaks to protect coverage rules
	•	Respects time granularity (15-minute blocks)
	•	Avoids illegal windows (lunch window constraints)

Output view
	•	Primary visualization: Timeline / Gantt chart, get inspiration from Notion.
	•	Y-axis: employees
	•	X-axis: day timeline
	•	Break blocks displayed on each row
	•	Working time shown as baseline (optional)

Generation behavior
	•	If a perfect plan is possible: generate and display
	•	If constraints are impossible: generate the best available plan or stop and show clear errors (see Validation section)

4) Manual adjustments + conflict warnings (required)

Functions
	•	Drag-and-drop break blocks in the timeline
	•	Resize break blocks
	•	Snap to the chosen increment (15 min)

Conflict detection (real-time)

If a manager makes an edit that violates constraints, the UI should:
	•	Show a visible warning on the timeline (e.g., red highlight on affected time block)
	•	Explain what’s broken (examples):
	•	“Cashier coverage falls below minimum at 2:15–2:30”
	•	“Lunch for Alex is outside the lunch window”
	•	“Two keyholders on break at 4:00–4:15”


5) Validation + explainability (required)

Before and after generation, the system should run checks and communicate clearly.

Validation checks
	•	Missing data (shift times, role tags when required)
	•	Over-constrained rules:
	•	Under-constrained rules:
	•	Scheduling infeasibility:
	•	“Cannot schedule all lunches within window while maintaining coverage”


Key Screens (Designer deliverables)
	1.	Daily Setup
	•	Employee list + shifts + role tags
	•	“Add employee” flow / quick row entry
	2.	Parameters
	•	Break rules by shift length (range-based editor)
	•	Coverage rules (total + role-based)
	•	Time granularity setting
	3.	Schedule Timeline
	•	Generate button + regeneration states
	•	Gantt chart view
	•	Warnings/errors panel
	•	Drag/drop editing
	4.	Publish
	•	Print/PDF layout
	•	(Optional) staff view mode
	5.	Empty / Error states
	•	No employees added
	•	Missing parameters
	•	Over-constrained schedule errors
	•	Partial schedule with warnings



Primary User Flow
	1.	Manager opens app → selects date
	2.	Adds employees + shifts + roles
	3.	Sets/loads parameters
	4.	Clicks Generate
	5.	Reviews timeline
	6.	Adjusts breaks if needed (warnings guide changes)
	7.	Publishes/prints for staff