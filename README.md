# LongLiveTheQueen-Guide
A semi-comprehensive guide to the game Long Live the Queen by Hanako Games and Spiky Caterpillar

Things not covered by this guide
1. Any line of dialogue or the decisions that determine them. If you want the full narrative experience, play the game.

Things covered by this guide
1. Visible player stats - mood, skills, army size, money
2. Hidden player stats - cruelty, commoner approval, noble approval
3. Checklist items - deaths and narrative achievements
4. Epilogue windows
5. Player choices that impact the above

I highly suggest buying the game and playing through a couple times before using this guide. It is a well made strategy / simulation indie that is available on Windows, Mac, and Linux with a very resonable price and is available both on Steam and from the [devs](https://www.hanakogames.com/llq.shtml).

# Notation Used
Labels

Labels are followed by colons, e.g. 'A Beautiful Day:'. They serve no mechanical purpose in this guide and exist purely to aid the reader to orient themselves and align with in-game events.

Variables
- I, A, F, C, D, W, Y, P, L - Individual measures of the 5 axes of Elodie's mood
- K - Elodie's Cruelty
- R - The size of the Novan army
- G - The amount of lassi (money) available
- Ca - The commoner approval for Elodie
- Na - The noble approval for Elodie

Mood Offsets

Elodie's mood is changed through the use of offsets e.g. 2A, -CP, 3F2W. Numeral ones '1' are omitted, so P instead of 1P. And all numbers (including negatives) apply only to the next axis letter, so -CP is the composition of -C then P. Applying mood offsets is explained on the moods page.

Misc Offsets

Elodie's miscellanous stats (non-mood, non-skill: K, R, G, Ca, Na) are changed by offsets: 0.5K, -200G, 10Ca, but may also be given using plus-equals and minus-equals operators as necessary, e.g. R -= dead_soldiers.

Skills

Skills are referenced by their full name, e.g. Internal Affairs, and are only referenced in skill checks which are conditionals. Increasing skills and the class mechanic is explained on the skills page.

Skill Subgroups

Subgroups are referenced by their name, e.g. Military, and are only referenced in subgroup checks which are conditionals. This is explained on the skills page.

Flags

Flags are Boolean variables referenced by a single word name, e.g. Mentor. They default to false and are set to true when they first appear in the guide outside a conditional. A set (true) flag cannot be unset (made false.) Flags provide narrative context to the game's state and should be considered as potential spoilers.

Conditionals

Conditionals are wrapped in parentheses [brackets]. A condition's block is indented directly below it. Single statement blocks may be inlined after the condition. Vertical stacks of conditions form an if - else if structure, with a terminating else being represented by an empty parentheses. The end of a group conditions is signifed by an else '()' or an empty line and reduction of indentation.
    
    (condition A) expression 1
    (condition B)
        expression 2
        expression 3
    
    (condition C)
        expression 4
    ()
        expression 5

In the above example, if conditions A, B, and C are all true, expressions 1 and 4 are executed, as A has precedence over B and C is the start of a new group of conditions.

Operations within Conditionals
- Boolean: not, or, and
- Numerical: <, >, <=, +

Menus

Player choice options are wrapped in square brackets and presented vertically. An option's block appears indented immediately after it. If an option's existence is conditioned, that condition appears inline, to the right, with its enclosing parentheses. Options without a condition and with a simple block may have the block inlined to the right.
    
    [Option A] Expression 1
    [Option B] (Condition B)
        Expression 2
    [Option C] (Condition C)
    [Option D]
        Expression 3
        Expression 4

In the above, the players choice of Options A, B if available, C if available, and D determines which of Expression 1, 2, and 3 and 4 are executed (if any, as Option C lacks an expression.)

Special Weekend Activities

Special weekend activities are presented as a menu. The default weekend activities (see the weekends page) are not presented and may be overriden by special weekend activites with the same name. As special weekend activities exist mostly outside of the game's weekly structure, there is a redirection notation ':Weekend n' which indicates to use the activity from the nth week's weekend. Redirection does not imply the existence of the special weekend activity, any conditionals must still be true.

Checklist Items

Checklist items are given by their name wrapped in quotation marks, e.g. "Off With Their Heads". These include achievements and specific deaths. The 'Die five ways' and 'Die eleven ways' checklist items are not included.

Losses

Deaths and other early endings are paired with specific elements "Ending: Death", "Ending: Generic", and "Ending: Evil".

Epilogue Windows

Epilogue windows are given by Window number, undecorated. These appear during the epilogue (Week 40) or after a "Ending: Generic" or "Ending: Evil"

Pseudocode

In a small number of places, the guide includes general pseudocode for computing some specific variables applicable in that content. This pseudocode is limited to basic math and variable assignment.
