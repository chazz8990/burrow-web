# Burrow patch notes

Newest update on top. You can also read these in the game: press Esc, then **Patch notes**.
Older builds used "art" tags: v0.24.4 was art24d and v0.24.3 was art24c. The sections below those are the older builds, kept under their art tags.

## v0.26.31

A quick fix for phones and tablets.

### Fixed
- **JUMP jumps again:** the on-screen JUMP button was pumping the hose instead of jumping. It now jumps, also while you hold the stick.
- **DIG digs again:** with "Tap a block to dig" on (the phone default), the DIG button did nothing. Hold DIG to dig the way you are facing, or hold the stick and DIG to dig in that direction. Tapping a block still digs it.
- **New PUMP button** for the hose, since JUMP no longer does that.
- **iPhone touch fixes:** holding a button no longer selects text, opens the iPhone pop-up menu or zooms the page.

## v0.26.30

Cloud saves: play the same burrow on your PC, Legion Go and phone.

### New
- **Cloud saves (Settings > Cloud):** press **Turn on cloud saves** to get a private sync code. On your other devices press **I have a code** and type it in (the dashes are optional). Only the newest burrow is used, and your settings stay per device.
- **One device at a time:** if your burrow is open on another device, you'll see "Playing on PC - Take over?". Take over and the other device stops with "Continued on Legion Go" and uploads nothing, so it can't overwrite your newer game. Press **Play here instead** there to switch back.
- **Saves upload by themselves** every 30 seconds while you play, when you pause, and when you quit. The newest cloud save loads when you start.
- **Restore backup:** the cloud keeps your last 5 saves (one about every 10 minutes, and one each time you switch devices). Pick one to go back to.
- **Offline is fine:** with no internet you keep playing and a small "Cloud: not synced" mark shows. If the cloud changed meanwhile you get a choice with both save times. Nothing is ever overwritten without asking, and the one you don't pick is kept as a backup.
- **Device names** are guessed (PC, Legion Go, Phone...) and you can rename them.

### Notes
- Keep your code private: anyone with it can load your burrow. There are no accounts and no passwords to leak. The server only stores a scrambled version of the code and limits how often it can be used.
- Co-op is not affected. While you play in a friend's world, cloud saves pause, and they start again when you're back in your own world.

## v0.26.29

A small polish update.

### New
- **Pick up farm buildings with a controller:** hold RT next to a Farm Plot, Chicken Coop or Animal Pen to pick it up. A green outline and a "Hold RT: pick up" label show what you'll get. A quick tap of RT still plants, harvests, waters or feeds like before. The animals come back when you place the coop or pen again.
- **What's new shows everything you missed:** if you skipped a few updates, the pop-up now lists every update since you last looked, newest first. Scroll it with the mouse wheel, W/S, the arrow keys or the D-pad.

### Changed
- **Touch:** press and hold a Farm Plot, Chicken Coop or Animal Pen to pick it up. A quick tap no longer picks it up by accident.

### Fixed
- On 16:9 phones (like 1920x1080), the TAB and CLOSE buttons in menus no longer sit on top of the menu's bottom edge and hint text.

## v0.26.28

A small safety update for co-op hosting.

### Fixed
- Hosting is harder to tie up from other devices on your network. Connections that never finish joining are now closed after a few seconds, and only a few can wait at once.
- A player whose connection goes completely silent for over a minute is now dropped, so their slot frees up. Normal play, idle players and paused games are not affected.

## v0.26.27

Steam Deck and phone support.

### Added
- **Steam Deck:** the game fits the 1280x800 screen. The first time it starts on a Deck it uses the Handheld UI size, so text is easy to read. You can still pick another size in Settings.
- You can play the whole game with the Deck's controls, including typing a co-op code or name with the gamepad.
- A Linux version (AppImage) for the Steam Deck and other Linux PCs.
- **Phones and tablets:** touch controls show up on their own on a touch screen. There's a stick to move, plus DIG, JUMP, PACK, MAP, CRAFT, EAT, DRINK and a menu button.
- A **Touch** settings tab. It has button size, left-handed layout, and a Battery saver that runs at 30 frames a second.
- Hold a finger on something to use it, like a right-click. Pinch the map to zoom, and use the LEGEND button to show or hide the key.
- On a phone, tapping a co-op name or code field opens the keyboard. A CHAT button shows up in co-op.
- On a phone, the first tap on a skill shows what it does. Tap it again to learn it.
- The web version can be added to a phone's home screen and opens without a connection.

### Changed
- The game checks for updates every 5 minutes instead of every 2.
- In single player, the game pauses when you switch to another app on a phone.
- On a touch screen, the hints name the buttons instead of keys. The key strip in the corner is hidden so it doesn't cover the buttons.
- In the shop, the header says "B close" when you're using a gamepad.

### Fixed
- The cabin lamp stays on the ground-floor window after House Upgrade II.

### Notes
- Old saves load fine. Co-op works the same.
- The town is the same.

## v0.26.26

House Upgrade II, cooking tabs on a gamepad, and bigger new pests.

### Added
- House Upgrade II at Wick's shop for 15,000g. It shows up once you have the first House Upgrade. It adds a loft over the new room and a third storage chest, Storage 3.
- Storage 3 starts with 30 slots. Buy "Storage 3 +10" at Wick to grow it to 120. It costs the same as the other chests.
- Storage 3 is private, like your other chests. In co-op, everyone sees your bigger house.

### Changed
- On a gamepad, LB and RB now move between the crafting tabs and the Cooking tab. A and D (or the arrow keys) do the same on a keyboard.
- The seven pests added in v0.26.23 are drawn bigger, and their hitboxes are a little bigger, so you can see them from further away. Each one still fits in a one-tile tunnel.

### Notes
- The town layout is the same. The house grows taller, not wider.
- Old saves load fine. Houses with one upgrade stay as they are until you buy the second one.

## v0.26.25

Lake-draining puzzle.

### Added
- Lakes drain now. Dig a channel next to a lake and its water runs into lower open cave, a tile at a time. The lowest spot fills first.
- The water keeps its amount, so a small cave only takes part of a lake. Dig deeper or into a bigger cave to drain more.
- A lake left with a quarter of its water or less dries up. It no longer counts as a lake for fishing or the map. Water that pools in a cave counts as a new lake, and you can fish there.
- Sunken chests. A few lakes in each world hide a sealed relic chest in the lakebed. Walk close and a short hint shows which lake. Drain it to unseal the chest, then dig it open for extra gold and a rift shard.

### Changed
- The starter lake by the Angler still can't be dug or drained.
- If the water under your bobber drains away, your line comes back in.

### Notes
- You can't drown and you can always swim up, so a flooding cave can't trap you.
- Old saves load fine. Sunken chests are only added to lakes you haven't seen yet. A lake that already had open cave beside it starts to flow when you load.
- In co-op only the host moves water. Friends see it through the normal tile updates.

## v0.26.24

Hotfix for the new pests.

### Fixed
- Pests no longer spaz back and forth in place. In a small pocket (like the gap next to a ladder shaft) a pest used to turn around every frame. Now it walks all the way to the wall before it turns, turns at most a couple of times a second, and just sits still if the pocket is too small to walk in. This hit every pest, but the long new ones (like the Loam Centipede) showed it most.
- Pests also stop flickering at the town fence and when they bump into you near the surface. They turn away and back off for a moment instead.
- Pests can no longer spawn or get stuck inside rock. Old saves are cleaned up when you load them.

## v0.26.23

Patch 4: The Underground.

### Added
- The underground now goes in stretches. You dig through a fight band full of pests, then reach a quiet band where nothing spawns. Quiet bands can hold a rest pocket: a small, safe cave with a campfire. Pests can't get in. Rest pockets show on the map once you have seen them.
- New pests in each layer. Each has its own look and its own entry in the pest book:
  - Loam: Sod Hopper (a fast mite) and Loam Centipede.
  - Bedrock: Bedrock Crab. It is slow but takes an extra pump.
  - Gloom: Gloom Wisp and Gloom Spider.
  - Magma: Ember Newt (quick) and Slag Crawler (slow, tough, hits for 2).
  Some new pests drop food or materials, like Crab Meat and Newt Tail.
- Pests slowly come back in the fight bands. They spawn out of sight, never in a quiet band or rest pocket, and there is a limit on how many can be near you.
- Cooking menu. Press E at any campfire to cook, including the one in town and the ones in rest pockets. There are 8 new recipes, such as Cave Omelette, Baked Potato, Warm Milk, Fish Chowder and Crab Cake.
- You learn a recipe the first time you pick up its key ingredient. Locked recipes tell you what to find. Your learned recipes are saved.
- Angler quests. The Angler gives you fishing jobs, like "Catch 3 Cave Minnow". You get gold and bait for each one. The current quest is at the top of his list and on the Missions page. Each player in co-op has their own quests.

### Changed
- Meals moved out of the crafting Food tab and into Cooking. All the old meals and fish dishes still work. Opening crafting at a fire shows a Cooking tab.

### Notes
- Old saves load fine. Rest pockets are only added in rock you haven't explored yet.

## v0.26.22

### Added
- Day and night up top. A full day lasts 20 minutes, about as long as a full food or water bar. Daytime is about 13 minutes and night about 6, with a short sunset and dawn in between.
- The sun moves across the sky and sets behind the hills. The sky turns orange, then the moon and stars come out. At night the town gets darker, but the lamp posts, campfires and your lamp still light it up. Name tags and the HUD stay easy to read.
- The Shady Dealer only shows up at night. He leaves at dawn.
- In co-op, everyone sees the same time of day (the host's). The time of day is saved with your world. Old saves start in the morning.
- Lakes have fish swimming in them. You see the same kinds you can catch in that lake, with the same colours. Bigger kinds look bigger. Rare fish glow and Crystal Koi sparkle.

## v0.26.21

Patch 1.

### Changed
- Long Reach is gone. You can always dig the block 2 tiles above you: hold W, or left-click it. Other directions dig the block next to you. If you had Long Reach, you get all those skill points back.
- Food and water go down half as fast. A full bar lasts about 20 minutes on Normal.
- Food and water slowly fill up while you are up top in town. Empty to full takes about 25 seconds. In co-op this works for each player.
- You can only fish in lakes now. Pools and springs are too small, and the Fishing Map only marks lakes.

### Added
- Hover over an item on a loot card or in Recent loot to see its tooltip.

### Fixed
- Angler's hut: the fishing rods no longer poke through the roof, and the "&" on the Bait & Tackle sign is easier to read.
- You can talk to the Angler (E) from his fishing ledge.

## v0.26.20

### Changed
- A, S and D now only dig while you hold them, like W. A quick tap just moves.
- You can cook at the campfire in town: press E next to it.
- Left-click a Farm Plot, Chicken Coop or Animal Pen to pick it up.

## v0.26.19

### Changed
- Menus: the extra buttons next to Close are gone; use the tabs along the top to switch.

### Fixed
- Behind-the-scenes improvements.

## v0.26.18

Menus now have tabs along the top, so you can jump between them. Tap W to jump, hold W to dig up.

### Added
- Pack, Craft, Skills, Goals, Missions, Fish Log, Map and Controls now share a row of tabs above the menu, each with its own icon. Click a tab, press , and . on the keyboard, or press LT and RT on a controller to switch.

### Changed
- Tap W to jump, hold W to dig up. A tap always jumps, even right under a block. Hold W (or up on the stick) for a moment to dig the block above you, or with Long Reach the first block within reach. Ladders, ropes and beams still climb with W as before.
- Long Reach now goes up to rank 2, which reaches 3 tiles. If you had rank 3, it drops to 2 and you get that skill point back.
- Autosave now runs every 30 seconds.
- The Graphics tab in Settings now matches the General tab: two tidy columns with the same headers, labels, checkboxes and value pickers. Every option works as before.
- The JOB box on the left of the screen now stays the same width as the boxes around it. Long jobs wrap onto a second line instead of sticking out.

### Fixed
- You can jump again under a ceiling that Long Reach can reach. Before, W dug a block far above you instead of jumping, or cut the jump short.

## v0.26.17

Long Reach now reaches in every direction, and fish can be sold one at a time.

### Changed
- Fish can be sold one at a time or all at once at the Angler and Wick.
- Removed the lake distance and bait text from the screen.
- Removed the built-in bench by the house. Craft a Workbench from the Tools tab and place it to unlock bench recipes.
- Fishing Map spots now show as little fish, colored by the rarest fish there (green uncommon, blue rare).

### Fixed
- Long Reach now works in every direction, up included: W digs the first block above you within reach.
- The Burrow logo is back on the app and desktop shortcut.

## v0.26.16

A quick fix for the update pop-up.

### Fixed
- Fixed the What's new pop-up showing blank.

## v0.26.15

The Angler moved down to the first fishing lake by the shaft ladder, in his own Bait & Tackle hut.

### Added
- **The Angler has a new home.** He now runs a Bait & Tackle fishing hut beside the first fishing lake, at the bottom of the shaft ladder.
- **The Angler got a makeover.** He has a new look: a bucket hat full of flies, a fishing vest, a rolled-up flannel shirt and a fresh trout to show off.
- **A spot to fish from.** There's a 2-block ledge at the water's edge between the ladder and the lake, so you can stand right next to the water and cast.
- **The lake and the hut are protected.** The floor under the hut, plus 2 blocks past its far side and the 1 block between it and the ladder, every block touching the first lake's water (its bed, its side walls and the fishing ledge), and the water itself can't be dug or blown up, in solo and co-op. Missing floor blocks there are filled back in with stone.

## v0.26.14

A fishing stall in town, a map that shows every lake, and Hide my IP paused.

### Added
- **The Angler.** A fishing stall just outside the west town fence, by the shaft. Walk up and press **E** (pad: **A**). He sells the Fishing Rod (30g), Worm Bait (3g) and Glow Grub Bait (9g), and he buys your fish for the same price as Wick.
- **Fishing Map (300g, one-time, at the Angler).** Once you own it, every lake and spring shows a small fish on the **M** map and the minimap, even places you haven't explored yet. It's saved with your miner, and in co-op each player buys their own and keeps it when they go home.

### Changed
- **Fishing gear moved to the Angler.** Wick's Glintery no longer sells the rod or bait. Gear you already own stays yours, and Wick still buys fish.
- Hide my IP is turned off for now: its free relay service shut down. It'll come back once the game has its own relay.

## v0.26.13

Hills and trees that look natural, a deeper town ladder, faster ladder slides, decorated cabins and a cleaner HUD.

### Added
- **Ladder slide.** On a ladder, beam or rope, hold **Shift** (pad: **L3**) and press **down** to slide down fast. It uses no stamina and you land at the bottom safely.
- **Shaft Ladder at Wick's Glintery.** Buy the town shaft ladder deeper in 4 steps (150g, 400g, 900g, 2000g). It never cuts through your blocks, chests or water, and ore in the way is moved to one side. In co-op only the host can buy it.
- **Cabin decor.** The inside of your cabin now matches your miner. A girl's cabin gets fairy lights, a heart wreath, pictures, a vanity mirror, flowers and a pink rug. A guy's cabin gets antlers, crossed pickaxes, a tool rack, a pennant, a framed jersey, a dartboard, a lantern, balls and a plaid rug. Friends' cabins follow their own miner.
- **App name.** The desktop app now shows as **Burrow: Deep Hollow** in the title bar and Task Manager. Your Burrow shortcut on the Desktop or Start Menu is renamed **Burrow - Deep Hollow**. Your saves, install folder and updates are unchanged.

### Changed
- **JOB sits under NEXT.** The job line now shows right under your NEXT goal, and Bounties moves down below it.
- **Bounties tab.** The folded Bounties tab now matches the other HUD panels: same color, border and gold label.
- **Hills.** The background hills now reach down to the ground, and the sun sets behind them.
- **Trees and flowers.** Surface trees and flowers are spaced more naturally.
- **Map and minimap.** Both now show the sky, hills and trees behind the ground. Lakes still stand out, and underground stays dark.
- **Miners camp by your house.** Rescued miners pitch their tents next to your cabin, not by the shaft. Old tents move there once. In co-op, walk the miner over to your own house and they set up camp there.
- **Friends' cabins.** A friend's cabin only shows while that friend is connected. Their house is still saved for next time.
- **Flat ground east of town.** The ground east of town is levelled, and the town strip can't be dug.
- **Tidier pause screen.** The top bar now reads **PAUSED**, then **Version v0.26.13**, then your **Live player count** (in green, hidden when it can't be read), all on one line, with the count centred over the Multiplayer button. **Check for updates** sits in the top-right corner, lined up with Edit Character, and **Quit Game** is now the bottom button of the right-hand panel. Multiplayer moved up next to Resume, so the left buttons have no gap. "Saves itself as you play" and "Last saved" now sit right next to Save, and the backup tip sits next to Export save and Import save. "You're up to date" no longer shows; you only see update news when there is an update. The "ESC resume, M = Map" hint is gone.

## v0.26.12

Stranded miners to rescue, a farm and animals for your yard, campfires you can build, a ladder fix for fishers and a few small comfort fixes.

### Added
- **Stranded miners.** Four miners are lost down the mine: Farmer Bramble (shallow), Prospector Gus, Cook Marlo and Cartographer Ines (deepest). Each waits in a small lantern-lit pocket with a "!" over their head, and a **"?"** marks them on your map (M) and minimap. The **JOB** line under your Bounties points to the nearest one.
  - Walk up and press **E** to talk. Choose **Lead me home** and they follow you. Talk again and choose **Wait here** if you need to clear a path; they stay put until you come back.
  - Bring them up to your yard and stand on open ground there. They pitch a small tent next to you (never under the shop, well, board or houses) and give you a thank-you gift.
  - Tents are part of the town: they can't be dug out, and you can walk through them.
- **Missions.** Each rescued miner has a chain of 3 short missions. Talk to them (**E**) to see the current one and to turn it in. Four of the missions, one per miner, pay **1 skill point**. Others pay gold, items and xp.
  - Farmer: plant 3 seeds, harvest 4 crops, bring 6 Sward Hay.
  - Prospector: bring copper, then silver, then gold ore.
  - Cook: bring carrots and potatoes, then eggs and milk, then Lamp Morels.
  - Cartographer: reach 60m, find 2 boss lairs, reach 120m.
  - Your journal (**J**) has a new **Missions** page with all four miners and their progress. Use the Missions button or **A / D** to switch between Goals, Fish Log and Missions. A **JOB** line under your Bounties shows your current mission and lights up when it's ready to turn in.
- **Farming.** The Farmer gives you Farm Plots, seeds and a Watering Can. You can also craft Farm Plots (4 dirt clods + 1 Sward Seed, makes 2) and a Watering Can (3 copper ore + 2 stone chunks) from your pack.
  - Select a **Farm Plot** and press **Q** to lay it beside you on open ground.
  - Press **E** on an empty plot to plant your selected seed (or the first seed in your pack), and **E** on a dry crop to water it (the can stays in your pack).
  - Watered crops grow one stage, then need water again. When it's ripe, press **E** to harvest: 2 of the crop and 1 seed back.
  - Crops: Sward Hay, Carrots, Potatoes and Lamp Morels. Carrots, potatoes and eggs are food, and milk is a drink. **Veg Stew** (1 carrot + 1 potato, cooked at a campfire) fills you up and slows hunger for a while.
- **Chickens, a goat and a cow.** The Farmer's missions give you a **Chicken Coop** and an **Animal Pen**. Place them like a Farm Plot (**Q**). Two chickens wander by the coop: press **E** on one for an egg (each chicken every 90 seconds). A goat and a cow live by the pen: feed one 1 Sward Hay (**E**) for milk (each every 2 minutes). The animals make quiet clucks, bleats and moos.
- **Saves and co-op.** Tents, plots, crops, coops and pens are saved with your world, and older worlds get their stranded miners the first time you load them. In co-op everyone sees the same camps, tents and farm. The host's game grows the crops. Missions, rescues and animal timers are kept for each miner separately.
- **Campfires.** Craft a **Campfire** from your pack anywhere, no workbench needed: 4 dirt clods, 4 stone chunks and 1 copper ore. Select it and press **Q** (your Use key) to set it down beside you on open ground with a solid floor. Within about 2 tiles of a lit campfire:
  - hunger and thirst stop draining
  - you get back 1 heart every 10 seconds while you rest (the "Resting" pill counts it down)
  - it counts as a cooking station: press **E** next to it to open crafting on the Food tab
  The flames flicker and glow in the dark like the fireplace in town. To take it back, open its panel and choose **Pick up**. Campfires are saved with your world and show up for everyone in co-op. You can't put one inside the town's protected buildings, and the town's no-enemy rules are unchanged.
- **Version on the pause screen.** A small "v0.26.12" now sits on the PAUSED title row. In the desktop app the version already shows there, so it isn't repeated.
- **"C skills" in the key hint line.** It's always first and lights up with "+n" when you have skill points to spend. On a gamepad it shows the mapped button, or it's left out if no button opens Skills. The row is a bit tighter. If it still doesn't fit, optional hints drop off the right end.
- **Shift+click splits a stack.** Shift+click a stack of 2 or more in the pack, hotbar, stash or Storage 2 to pick up half. With an odd count you get the bigger half, like right-click. Shift+click on a single item still quick-moves it, and Ctrl/Cmd+click still moves a whole stack.

### Fixed
- **The fishing rod no longer traps you under a ladder.** With "Left-click to dig" on, W never digs, and with the rod out every left click went to fishing. That meant the block above a ladder couldn't be dug. Now a left click with the rod out digs when no line is in the water. The rod is stowed on your back while you climb ladders and ropes, and climbing away reels the line in. The rivet gun had the same problem: clicking right on a block you can dig now digs it instead of firing a rivet.
- **Right-clicking the hotbar with the rod out no longer casts the line.** Mouse fishing ignores clicks on the hotbar and other HUD panels, also at Handheld UI scale. Right-clicking the rod's own hotbar slot puts the rod away.
- **Loot pop-ups no longer cover the CO-OP list, the minimap or the hotbar.** Only as many pop-ups show as fit above the hotbar. When they move to the left side, they start below the stats, NEXT and Bounties panels.

## v0.26.11

Mouse fishing, smoother frames, more detail, a real walk cycle, faster running and lakes for old worlds.

### Added
- **Lakes come to your existing worlds.** The first time you load a world made before v0.26.10, it gets the new lakes: a starter pond near the bottom of your mine shaft (dig a tile or two to reach it) and new lakes in places you've already explored, up to the new lake density. Only untouched natural rock and dirt is changed: nothing you built or placed, no chest, ladder, rope or tunnel you dug is touched. You'll see "New lakes appeared! Check your map." It only happens once per world. In co-op the host adds the lakes and everyone sees the same ones.
- **Walk animation.** Miners now take real steps: the planted boot stays on the ground (no more sliding feet), the swinging leg lifts and moves forward, and running uses a faster cycle with a longer stride. There are also poses for standing, jumping, falling, and climbing ladders and ropes. Other miners in co-op animate the same way.
- **Resume hosting after restart** (Multiplayer switch **Resume hosting**, on by default). If the game closes while you're hosting, for example to update, it starts hosting the same world again the next time you load it, with the same join code when it's free, the same Rejoin entry in Recent games and your Hide my IP choice. You'll see "Hosting again - friends can rejoin". Friends who were in the game in the last 10 minutes get straight back in without Allow / Deny (switch: **Recent back in**). Kicked players are still blocked. Friends who are in the game when the host closes wait and retry for about 2 minutes ("Host is updating - rejoining...") instead of dropping. Stop hosting turns it off for that game.
- **Fish with the mouse.** With the rod out, **right click** casts (toward the side you click, if there's water there), **left click** hooks the fish when the "!" shows, and **holding left click** reels it in. With the rod out, left click never mines or attacks and right click never places anything. Keys and controller work the same as before.
- When you last used the mouse, fishing hints show mouse buttons ("R-click" to cast, "L-click!" on a bite, "hold L-click" to reel). Otherwise they show your keys or controller buttons. The rod's tooltip mentions the clicks too.
- **Graphics > Detail** (Low / Normal / High, Normal by default). Normal and High add rock grain, soft shadows where caves meet rock, swaying grass, dust drifting in your lamp light, water drips from cave ceilings, moving sparkles on lakes and a softer lamp edge. High adds more dust, more drips and a bit more sparkle. Low is the plain look and the fastest.

### Changed
- **Running is faster:** about 1.6x walking speed (it was about 1.35x). The Run bar drains and refills at the same rate as before. Running never takes you through walls, floors or the roof of a 1-tile tunnel, at any frame rate.
- **The fishing bar responds right away.** Holding reel (key, mouse, controller or touch) now pushes the bar up in the same frame, and letting go starts it falling straight away. Before, it took about 0.3 to 0.5 seconds to react.
- **HUD, left side:** the **NEXT** goal line now sits right under your stats panel, with **Bounties** below it. Both are the same width with the same left edge and an even gap. Clicking the Bounties header or its folded tab works in its new spot.
- **HUD, right side:** the Lv panel, the CO-OP / HOSTING list and the minimap now form one column with the same width and edges and equal gaps. The minimap keeps its shape and is now exactly as wide as the panels above it. The "M map" hint sits inside the minimap's bottom-left corner instead of hanging over the town. The CO-OP list now follows the UI scale like the rest of the HUD (on Large or Handheld it used to stay small and misaligned). Loot pop-ups on the right now start below the whole column; when the column is too tall (Handheld UI with a full party), they move to the left side.
- **Smoother frames.** The game draws much less every frame:
  - The still parts of the world (tiles, edges, cave walls, roots) are drawn once into cached chunks and reused, instead of being redrawn tile by tile every frame.
  - The finished frame is copied to the screen once per frame (it used to be copied up to three times with the map or menus open).
  - With the pack open, relic outlines use a cached shape. They used to cost about 30 ms a frame, which dropped the game to about 25 fps with the pack open.
  - Autosave skips work when nothing changed and makes far less garbage, so it no longer causes a stutter.
  - Particles and effects no longer make new lists every frame (less garbage collection, fewer hitches).
- **Co-op:** other miners move more smoothly. Their positions are now timed by the sender's clock, so network jitter doesn't make them stutter.
- Desktop app: GPU rasterization is turned on for the game canvas (all platforms; vsync stays on).

### Fixed
- During a bite, the bait box ("no bait" or the bait count) no longer covers the "!" at any UI scale, small windows or in co-op. "press!" now sits beside the box, and the "!" over your head sits a little higher so it never touches your name tag.
- Help: the mouse rows no longer run off the bottom of the panel into the hotbar. When the left column is full they move to the right column.
- A very quick click in the pack could leave a stuck drag that blocked click-mining after you closed the pack.

## v0.26.10

Lakes, fishing and sprint update.

### Added
- About twice as many lakes underground (roughly 1.8x on a normal world), including small ponds on cave floors.
- Every new world has a starter lake: a small, shallow pond in a side cave at the bottom of the mine shaft by your base, with a dry ledge to fish from.
- Lakes stand out on the map and minimap: bright blue water, a pale surface line, a dark rim, and a small fish mark over every lake you've seen. The map legend has a **Lake** row.
- Three new fish: **Pebble Loach** (shallow lakes near the top), **Blind Cavefish** (deep, dark water) and **Ghost Pike** (rare, deep water in the Gloom). The Fish Log now shows all 9 kinds.
- Every fish has a size. The Fish Log keeps your biggest of each kind, and the catch card says **RECORD** when you beat it. A really big catch is a **TROPHY** and pays bonus gold.
- **Sprint.** Hold **Shift** while moving to run about 35% faster. On a controller, click **L3** while moving to toggle running (L3 standing still still opens the journal). Running uses the new **Run** bar next to the depth readout. It refills when you stop running. If you empty it, it turns red and you can't run again until it's a quarter full. You can't run on ladders or ropes, in water, while fishing or with a menu open. In co-op, other miners see you run, and each player has their own Run bar.
- With the rod out, a small ring on the water shows where your bobber will land.
- Just before a bite the bobber nibbles once or twice, with a ripple and a soft tick, so you can get ready. Wait for the "!" to hook. Bites now splash, and a controller gives a short rumble.
- In co-op, other miners see your fishing line, bobber and the "!" when you get a bite, and the name and size of what you catch over your head.
- With the rod out and no water in reach, the hint points to the nearest lake you've seen (for example "lake 14 tiles left").

### Changed
- Easier to hook a fish: after the "!" you now have 1.3 seconds to press (was 0.95).
- Pressing too early no longer pulls your line in. It says "wait for the !" and the fish takes a little longer to bite.
- Water depth matters: Mud Carp, Cave Minnows and Pebble Loach like shallow water; Stone Perch, Blind Cavefish, Ghost Pike and Crystal Koi like the deep middle of a lake.
- Fish sell for more: Cave Minnow 4g, Mud Carp 5g, Pebble Loach 6g, Stone Perch 8g, Glowfish 12g, Blind Cavefish 15g, Lava Eel 18g, Ghost Pike 26g, Crystal Koi 45g. Grilled fish sell for 3g more than raw. Better fish also give more XP.
- Wick's fish bounties can ask for the new fish.
- When you catch a fish, other messages (new recipe, bounty done) now slide below the catch card instead of covering it.

### Existing saves
- Your world keeps everything you built. New lakes only appear in places you haven't explored yet, away from your base, ropes, rooms and vaults. Old worlds don't get the starter lake, because the area around the shaft is already explored.

## v0.26.9

Bring your own miner. When you join a friend's world, you now play as your own miner.

### Added
- Your level, XP, skills, inventory and hotbar, bag size, gear, stash and house upgrade come with you when you join a friend's world.
- Your stash and Storage 2 stay private. In your friend's world you open them at your own house there, and nobody else can see or use them. If you have the house upgrade, your house there is upgraded too.
- Anything you earn or find while joined comes home with you when you leave or quit. It also comes home if the game or your computer closes unexpectedly; it's added the next time you open your own world. You'll see "Back home" when that happens.
- Before every join, the game keeps a backup of your own save.
- **Recent games.** Pause > Multiplayer > **Recent games** lists the last 10 hosts you joined, with when you last played and whether it was Online or LAN. Press **Rejoin** to go back without a new code. **Remove** takes one off the list and **Clear all** empties it. Works with mouse, touch and controller.
- The host still gets **Allow / Deny** every time someone rejoins, even with "Ask before join" off, and anyone on the host's kicked list stays blocked. If the host isn't playing, you'll see "Host isn't online right now."
- The list is kept only on your computer, and it only holds each host's name, when you played, and how to reach them: the LAN address you used, or the host's rejoin ID for online games. Codes, IP addresses and saves aren't stored.

### Changed
- Your own world's save is never written while you're in someone else's world.
- The host checks every miner that joins and trims anything out of range (levels above 50, impossible skills, items that don't exist, oversized stacks).
- Miners from earlier co-op visits (the level-1 one you got in that world) are replaced by your own miner. Your spot and map in that world are kept.
- LAN games now ask the host **Allow / Deny** too (if "Ask before join" is on, which it is by default). Until the host says yes, the friend waits and no world is sent. Deny isn't a kick: they can ask again later.
- **Storage 2** (the chest in the upgraded house's new room) now has its own size. It starts at 30 slots, like a new stash. Make it bigger with **Storage 2 +10** at Wick, at the same prices and sizes as the first stash (up to 120). Upgrading the first stash no longer makes Storage 2 bigger.
- On older saves, Storage 2 goes back to 30 slots. Nothing is ever deleted: if you already have items past slot 30, Storage 2 keeps enough slots to hold them, and they stay where they were. This works for the Storage 2 you bring into a friend's world too.
- **The well** in town is about 25% bigger and looks like a real well, with a shingled wooden roof, two posts, a crank with a rope and bucket, and a round stone base with water and moss. The edges of the roof and base are no longer cut off. It's in the same spot and works the same way.

## v0.26.8

Online co-op safety update. Nothing else in the game changes.

### Added
- Ask before friends join (on by default): when someone uses your online code, you get "Name wants to join" with Allow and Deny. No answer in 30 seconds counts as Deny.
- Kick: the host can remove a player from the Multiplayer menu.
- Kicked list: Multiplayer > **Kicked list** shows everyone you kicked and when. Kicked players can't join any of your games (online or Wi-Fi), even after a restart. **Unblock** lets one back in, **Unblock all** clears the list; they still have to ask, and you choose Allow or Deny. Works with mouse, touch and controller.
- Hide my IP: a big switch in the Multiplayer menu. With it on, online co-op goes through a relay server, so other players can't see your IP address (it may add a little lag). Hosts and joiners each choose for themselves. It's off by default.
- If Hide my IP is off while you host or join online, a yellow warning says your IP is visible to players in that game.

### Changed
- Online join codes are now made with secure randomness, so they can't be guessed from earlier codes.
- The game now checks every co-op message for size, type and sensible values before using it. Broken or oversized messages are thrown away, and a player who floods the game or keeps sending bad data is removed automatically.
- A friend can only change things near their own miner, can't pretend to be the host, and can't change your character, bag or gold.
- Desktop app: tighter security. Only the game itself can read or write your save, the game window can't be sent to other websites, and updates are only accepted from the official download page with a matching checksum.

### Fixed
- Co-op version check: both sides now check the real game version, so a friend on a different version gets a clear "please update" message instead of joining a mismatched game.
- The live player count no longer double-counts restarts.

## v0.26.7

### Changed
- Behind-the-scenes: anonymous online player count (no personal info).

### Fixed
- Hosting Wi-Fi co-op from the Windows app no longer turns friends away with "please update" when you're both on the same version.

## v0.26.6

### Changed
- Removed the House Upgrade sign; buy it from Wick's shop.
- Wick's shop list now ends with Pack Row, Stash Row, House Upgrade and then Skill Reset.
- Climbing a ladder (including the mine shaft) now shows your miner from behind, going hand over hand with each rung and holding the rails when stopped. Co-op partners see it too.

## v0.26.5

A bigger house with a second storage chest. This update also includes everything from v0.26.4: online co-op with join codes, and tougher, better-paying depths and bosses (see v0.26.4 below).

### New
- **House Upgrade (5,000g, one time):** buy it from Wick's shop, or at your house: walk to the **House Upgrade** sign next to your house and press E (RT on a controller), then press again within 4 seconds to confirm. If you don't have 5,000g, nothing is bought. Your house gets bigger and nicer, with a slate roof, a dormer window, a chimney, a flag and a new east room with a flower box. After you buy it, Wick stops selling it.
- **Storage 2:** the new room has a second storage chest. It has the same number of slots as your first chest, works the same way (mouse, touch, controller, Sort and Take all), and grows with Stash Row upgrades too. Walk up to it and press E (RT on a controller) to open it.
- **Co-op:** each player buys the upgrade for their own house. Everyone sees the bigger house, in Wi-Fi play and online play. Like your first chest, Storage 2 is private. Other players see it as locked. When you rejoin a host, your upgrade and Storage 2 items come back.

### Changed
- The campfire beside each house sits a little further east to make room for the new room.
- Old saves keep working. They start without the upgrade.

### Fixed
- In co-op, the storage chest label said "shared" even though each player's chest is private. It now says "private".

## v0.26.4

Deeper is tougher (and pays more), and you can now play online with a join code.

### New
- **Online co-op with join codes:** in Esc > Multiplayer, click **Host online** to get a 6-letter code. Your friend clicks **Join online**, types the code and presses Enter (or clicks Join online). It works over the internet. You don't need an account, and you don't need to set up a server or your router. The two computers link directly, using the free PeerJS service to find each other. Some strict routers or firewalls block this; if so, the game says so, and Wi-Fi play (Host game / Join game) still works as before. Up to 4 players, same as Wi-Fi play.

### Changed
- **Depth scaling:** each deeper biome makes pests and bosses tougher. In Gloom and deeper, pests need 1 more pump. In Magma and the Hollow, they also hit 1 harder. Everything moves a little faster the deeper it is. XP and gold from pests and bosses go up with depth to match. This stacks with World Tier.
- **Tougher bosses:** every boss needs 1 more pump, and 2 more in Gloom and deeper. There they also hit 1 harder. Bosses are also a bit faster and pay more XP and gold.
- **Loot by depth:** rare, epic and legendary finds from pests and chests are a bit rarer near the surface, and they get more common the deeper you go. Your luck counts a bit more the deeper you are. Boss drops are not cut.

### Fixed
- With a high World Tier, a boss's pump bar could show fewer pumps than its armor needed. The bar now always matches.

## v0.26.3

New skills, item dropping, a flat-price skill reset, and clearer menus.

### New
- **Long Reach (Mining skill, 3 ranks):** dig and build 1, 2 or 3 tiles higher. It works when you hold up while on a rope or rising in a jump, when you aim up with the controller, when you click to dig (if that option is on), and when you place blocks. On the ground, up still jumps. To unlock it, get Bit to rank 2.
- **Stout Heart (Survival skill, 3 ranks):** +1 max heart per rank, up to 9 hearts. Food that gives extra hearts still adds them on top. To unlock it, get Pocket to rank 2.
- **Drop items:** with the pack open, press Q over an item to drop one. Shift+Q drops the whole stack. You can also drag an item out of the pack, or onto the new **Drop** button. On a controller, RB drops one and LB drops the stack. The item lands on the ground in front of you. You only pick it back up after you step away and come back. In co-op, the other player can pick it up.

### Changed
- **Skill reset:** now always costs 2,000g, and you get back every skill point you spent. The price no longer goes up each time.
- **Magma music:** darker. It is slower and lower, with a heavier beat.
- **Settings:** the description at the bottom now matches the setting your mouse is over (or the one you touch, or the one picked with the controller). Every setting has its own short tip.
- **Build-fail reasons:** when a block won't place, a short message at that spot says why, for example "Too far", "Something's in the way", "Spot is not empty" or "No blocks".
- **Q in the world:** still means Use (place a block or Charge). It only drops items while the pack is open.

## v0.26.2

Real music, and a hotbox when you smoke your way home.

### New
- **Music:** the old drone is gone. Each place now has its own chiptune song: one for town and the surface, one for each layer underground (Loam, Bedrock, Gloom and Magma), and one for boss fights. The song changes by itself when you go deeper or a boss fight starts, and the songs fade into each other. The Music slider in Settings sets the volume. Set it to 0 to turn the music off.
- **Hotbox smoke:** when you use a Joint of Return or a Bong of Destiny, a puff of smoke grows until it fills the whole screen. It clears when you reach the other end. It lasts under 2 seconds, and the game keeps running in co-op.

### Changed
- **Sound effects:** no changes. Only the music is new.

## v0.26.1

Play the menus with a controller, and a Bounties tab you can fold away.

### New
- **Controller menus:** on a controller (like the Legion Go), the D-pad or left stick moves a gold highlight between buttons and rows. A presses, B backs out or closes, LB/RB switch tabs and Start opens or closes the pause menu. This works in the pause menu, Settings (left/right changes choice rows and sliders), Edit Character, Wick's shop, the bounty board and the Recent loot list. The pack, stash, crafting, skills, dealer and patch notes keep their own controller controls.
- **Bounties tab:** click or tap the top of the Bounties panel to fold it into a small "Bounties" tab in the same spot. Click the tab to open it again. The game remembers your choice. On a controller, hold LB+RB and press Y.
- **Claim from the HUD:** when a bounty is done, a glowing CLAIM button shows on the tab and on that bounty's row. Click it to collect the reward without walking to the board. On a controller, hold LB+RB and press X.

### Changed
- **Skills:** the skill picked with the controller now has a bright gold ring.
- **Shady Dealer:** on a controller, press X on a mushroom row to sell all of it.
- **Bounty board:** on a controller, A presses the highlighted button (Claim, Reroll, Boss Rumors or Close).

### Fixed
- **Bounties panel:** clicks now land in the right place at Large and Handheld UI scale.

## v0.26.0

Fishing, bait, a new name, a new-look dealer who buys mushrooms, and tidier menus.

### New
- **Burrow: Deep Hollow:** the game has a new name on the first-launch screens, the window title and the browser tab. Your saves and updates carry over as before.
- **Fishing:** buy a Fishing Rod from Wick for 30g. Hold it and press Q or Space (pad A) near water to cast. When the bobber shows a "!", hold to reel and keep the bar on the fish. A catch card shows what you landed.
- **Bait:** Worm (3g), Glow Grub (9g) and Magma Bait (dug from magma or made at the campfire). Bait is optional and one is used per cast. It brings faster bites and better rare odds, and Magma Bait lures Lava Eels in hot water.
- **Lakes:** cave lakes now form underground. Old saves get lakes in areas you have not explored yet.
- **Catches:** six fish, from the Cave Minnow up to the rare Crystal Koi, plus junk and the odd small chest. Press before the "!" and the line comes back empty; wait too long after it, or let the reel bar run out, and the fish gets away.
- **Fish Log:** a new journal page shows how many of each fish you have caught and where to find them.
- **The dealer buys mushrooms:** the Shady Dealer now pays about 1.5x Wick's price for Cave Morels, Stone Truffles, Lamp Morels and Wisp Caps. Sell 1 or Sell all, and trippy ones are marked with *.

### Changed
- **Cook your catch:** cook fish at the campfire for a bigger meal. Bounties can now ask for fish.
- **Update check:** the desktop app checks for updates every 2 minutes. If the server is busy it waits longer before checking again.
- **Settings:** the General tab is now two tidy columns: Gameplay, Controls, Display and Sound. "Left-click to mine" is now called "Left-click to dig".
- **Pause menu:** one column of buttons on the left, with your miner, world info and Patch notes on the right. Enemy info and Left-click to dig are now only in Settings.
- **Edit Character:** the pause button is now called Edit Character, and you change your name there too.
- **Key hints:** the key hints beside the hotbar are back as one faded row. You can turn them off in Settings > Controls > Show key hints.
- **Shady Dealer:** he has a new look, with a full cloak, shoulders and boots, and he smokes while he waits.
- **Pause top bar:** the Fullscreen button moved out (it is in Settings > Graphics). Check for updates and Quit Game sit together on the right.
- **New Burrow warning:** it now says plainly that it wipes your level, skills, gold, pack, stash and world.

### Fixed
- **Fullscreen:** in the desktop app, Fullscreen now really fills the screen and covers the Windows taskbar. It is remembered between launches, and F11 or Alt+Enter toggle it too. There is now one Fullscreen setting, in Settings > Graphics, and its checkbox always shows the real state.
- **Controller B backs out:** pressing B now closes Skills and any other open menu or panel, the same as Esc, so you are never stuck without a keyboard. With no menu open, B still drinks.

## v0.25.15

Safer lava vaults, a shady dealer in town, and faster update checks.

### New
- **Shady Dealer:** a hooded figure lurks by the fence at the west edge of town. Press E (or pad A) next to him to buy a Joint of Return for 400g or a Bong of Destiny for 600g. Both still drop as loot too.
- **Leave vault:** hold E inside any puzzle vault to walk out at its entrance. If you get sealed in, the hint says so and shows how to leave.

### Changed
- **Flow preview:** the Slagforge flow preview now matches what you dig, including 1-wide shafts and drops. The gold Forge Basin is marked from the start, and an X shows where the lava stops.
- **Clearer vault hints:** three short lines show the goal, where the flow ends now, and how to reset or leave.
- **Update check:** the desktop app now checks for updates every 5 minutes while you play (still at most once a minute when you switch back to the window).

### Fixed
- **Trapped in a vault:** a 1-wide shaft can be climbed by holding W, the vault walls and entrance stay diggable, and pressing E twice to reset refills the vault and puts you back at the entrance, never inside the lava.

## v0.25.14

Air jumps and the Spring Boots skill.

### New
- **Air jumps:** tap W (or Up) again in mid-air to jump again, up to 2 times. You get them all back as soon as you land (or grab a rope or ladder). Holding W still gives just one jump, and ceilings still stop you.
- **Spring Boots skill:** a new Mining skill under Sandfish (needs Sandfish 2) with 3 ranks. Each rank adds one more air jump, up to 5.

## v0.25.13

HUD labels, live update checks, a clearer What's New card and pack screen.

### New
- **Live update check:** the desktop app looks for new versions while you play, every 10 minutes and when you switch back to the window (at most once a minute). When one is out, a small "Update vX available" note appears at the top with **Update now** and **Later**. Later hides it until the next version, and the pause-menu button turns into Update now too. Nothing shows when you are offline.
- **Hotbar row in the pack:** the pack screen shows your hotbar as a numbered top row (1 to 0), so it is clear which slots are the hotbar. Drag items into it like any other slot; your pack sits underneath.

### Changed
- **Hunger and Thirst labels:** the HUD bars say Hunger and Thirst in full instead of "H" and "T", in the same orange and blue. Nothing overlaps at any UI scale, and the eat and drink tips name the bars the same way.
- **Shorter What's New:** the first page shows up to 8 short bullets, one line each. Press Right, scroll or use the d-pad for the full details on the next pages; Read patch notes still has everything.

### Fixed
- **Red "you" box:** the red placement box no longer flashes over the miner when the cursor passes over him.
- **Movement:** the v0.25.12 floating-miner fix is unchanged; jumps and falls stay normal.

## v0.25.12

An urgent movement fix.

### Fixed
- **Floating miner:** holding or tapping W no longer carries you up into the sky, and you fall at normal speed again. In v0.25.11 the check for ground under your feet was broken, so the miner could jump off thin air, walk on it and drift down very slowly. Jumps, falls and collisions work normally again everywhere, on new and old saves.

## v0.25.11

A town, campfire and shop update.

### New
- **Waypoint Pin:** a one-time 1,000g unlock at Wick's Glintery (it takes no pack slot; the row then shows Owned). On the full map, click a spot (or press P / pad A at the centre cross) to drop a flag; placing it again moves it, and X clears it. The flag shows on the full map and the corner minimap, and an arrow at the edge of the screen points to it with the distance across and down in meters. It hides when the flag is on screen. One flag per player per world; in co-op each player keeps their own.
- **Bigger pack:** two more Pack Rows, up to 80 slots (was 60). Pack Rows now cost 150g, 350g, 600g and 1,500g. The row leaves the shop once your pack is full size.

### Changed
- **Roomier town:** the sign, lamps, well, bounty board, shop and bench are spread out so nothing touches. Your house, plots, stash and spawn stay where they were.
- **Fireplace by the house:** the campfire now sits just outside your house's east wall, clear of the bed, chest and mailbox. It heals the same as before. A Furnace or Workbench that was built on the mailbox is moved once to a free spot beside the house.
- **Nicer fire:** the campfire and Furnace have layered flickering flames, rising embers, a warm glow (stronger at night and underground) and a thin smoke wisp. Fewer embers on the Low particles setting.

### Fixed
- **Shop rows line up:** every row's name, price and BUY button share one row, the highlighted row always matches the tooltip, and long lists shrink to fit inside the panel at every resolution. The sell grid fits a 70-slot pack.

## v0.25.10

A small Balloon and pump update.

### Fixed
- **The hose aims up:** hold Up (or Up + Left/Right) with Pump to aim the hose straight up or diagonally over your head. Pointing the mouse or the right stick also aims it. A pest floating at the ceiling above you can now be pumped and popped. Before, the hose only reached pests to your side, and holding Up just dug the ceiling.
- **The hose stays on a rising pest:** once you are pumping a pest, the hose follows it as it floats up.
- **Pests against a ceiling or in a block can be hit:** they still take pumps, rivets and bomb blasts, and pop normally.
- **Ballooned pests fall back down:** when a floating pest or boss deflates, it now drops with gravity until it lands on solid ground, then walks and chases as normal. It never falls into or through blocks, and stuck monsters still pop out to open space.
- **Balloon floats slowly at every rank:** floating foes rise at one slow speed (a bit slower than rank 1 before), so you can keep pumping them while they rise. Higher ranks float them higher instead of faster: 2 tiles at rank 1, 3 at rank 2, 4 at rank 3.

## v0.25.9

A small bug-fix update.

### Fixed
- **Balloon only floats the pest you pump:** before, any swollen pest floated, including ones swelled by bomb blasts or by Balloon's own pop-bombs, so whole groups of monsters drifted away. Now only pests a miner actually pumps float. Balloon floats just as fast as before.
- **Balloon no longer floats pests into stone:** floating pests (and bosses) stop under the ceiling instead of drifting into solid blocks, so they stay easy to pump and pop at every Balloon rank. Any monster that does end up stuck inside a block pops out to the nearest open space.
- **Campfire heals reliably:** stand within 3 tiles of the camp campfire while hurt to get +1 heart every 6 seconds, with green + sparkles while it heals you. It still pauses for 3 seconds after you get hit. Before, it could stop healing for good after you started a new world tier.
- **Updates install reliably on Windows:** the installer now starts in its own window that keeps running after Burrow closes, writes to its log from the very first step, and starts Burrow again if it can't run. If a downloaded update still didn't install, the next launch shows an "Update didn't install" notice with Retry and Open folder. Old update downloads are cleaned up after a successful install.

### Changed
- **Check for updates is on the pause menu now:** it sits in the top bar next to Quit Game (desktop app only), shows your version and then "You're up to date" or an Update now button. Gamepad: X. It's no longer in Settings > General.
- **Simpler display settings:** Settings > Graphics has one Fullscreen On/Off. On fills the screen with no frame at its own resolution; Off is a normal window you can resize. The Window mode and Resolution pickers are gone; the game scales to the window like before (16:10 still has no black bars). Your old choice carries over: Fullscreen or Borderless becomes On, Windowed becomes Off.

## v0.25.8

A tiny update, and another test of online updates. If you see v0.25.8 in the corner, the update installed.

### Changed
- **Controls strip fits more at Handheld UI scale:** the hint chips in the bottom-right are drawn a little smaller at Handheld, so more of them fit beside the hotbar.

## v0.25.7

A small update, and the second test of online updates. If you see v0.25.7 in the corner, the update installed.

### New
- **Check for updates button in Settings:** in the desktop app, Settings > General shows your version and a "Check for updates" button (Y on a controller). It tells you if you are up to date, offers "Update now" when a new version is out, or says why it could not check.

## v0.25.6

A small update, mostly to test that online updates work. If you see v0.25.6 in the corner, the update installed.

### Fixed
- **Update bar no longer covers goal popups:** when the "Update available" bar is showing, the GOAL popups now appear just below it instead of under it.
- **Safer installs on Windows:** the installer waits for Burrow to close fully before copying files, handles folder names with spaces, keeps a log, and always starts Burrow again. If an update ever fails to install, the game tells you the next time you start it and shows where the log is. Your saves are never touched.

## v0.25.5

Online updates are switched on for the desktop app.

### New
- **Online updates:** the desktop app now checks for new versions when it starts. When one is out, a small message offers it, and one click downloads it, checks it and installs it, then Burrow restarts on the new version. Your saves and settings are not touched. The browser version just gets the new files when you load the page.

## v0.25.4

A quick fix for the desktop app: you can now quit from inside the game, and closing the window always saves.

### New
- **Quit Game button:** in the desktop app, press Esc and pick Quit Game at the top of the pause menu (it is also on the Choose-your-miner screen). A small box asks "Save and quit?". On a controller, press Y to open it, then A to quit or B to cancel. The game saves everything first, then closes. If you are hosting co-op, your world is saved and your friends get the usual disconnect message. The browser version does not show this button, because there you just close the tab.

### Fixed
- **The game now saves when you close the window:** closing the app with the X button, Alt+F4 or from the taskbar now saves your game before the window goes away (it waits up to 3 seconds for the save to finish).

## v0.25.3

Three new kinds of puzzle vault in the deep, plus two controller fixes. Your save carries over and gets the new vaults too.

### New
- **Cairnstone Vaults (boulder push):** walk into a boulder and keep pushing to roll it one tile. Boulders drop when there is nothing under them and come to rest on ladders. Fill every glowing plate on the floor to open the vault door. Stuck? Press E twice inside the room to put every boulder back where it started.
- **Duskglass Vaults (light beams):** a beam of light shoots across the room. Press E near a Duskglass crystal or click it to turn its mirror, and bend the beam into the receptor to open the door.
- **Slagforge Vaults (lava channels):** dig channels through the soft dirt, then pull the Sluice Lever with E. The lava falls first, then spreads sideways. Lead it into the Forge Basin to open the vault. Keep it away from the Cinder Trap: if lava reaches the trap, the room warns you and refills its dirt so you can try again. While you are near the room, small dots show where the lava would go right now, plus a label saying where it ends. Flowing lava stings for 1 heart and knocks you back. It never takes your last heart.
- **9 puzzle vaults per world:** 3 of each kind, and the deeper ones are harder (more boulders, more crystals, longer channels). A small world gets one of each. The old Rune Vaults are still there.
- **Vault rewards grow with depth:** gold, Rift Shards and XP, plus a chance at one of three new relics: Cairnweight Idol, Duskglass Prism and Slagforge Heart. The deeper the vault, the better the chance.
- **Map markers:** vaults you have found (and Rune Vaults in places you have explored) get a vault marker on the world map. It turns grey once the vault is open.
- **Room signs:** walk up to a vault and a short hint shows its controls.
- **Co-op:** the host keeps track of every puzzle, so pushes, crystal turns and lava pours from friends work too. Everyone sees the same room, and every player near the vault when it opens gets their own reward. A chest waits inside too.

### Changed
- **Old saves:** the first time you load an older world, new puzzle vaults are added only in rock you have not explored yet. Nothing you have dug, built or seen is changed. A backup of the old save is kept first. If you have explored almost everything, fewer vaults (or none) may fit.
- **Shoulder buttons:** LB and RB still step through the hotbar, but now on release, so they can also be used for the new slot shortcuts.
- **Version numbers:** everything now says v0.25.3.

### Fixed
- **Picking a hotbar slot on a controller:** hold LB and press A, B, X or Y for slots 1-4. Hold RB and press A, B, X or Y for slots 5-8. Hold both and press A or B for slots 9 and 0. Food, drinks and other consumables get used just like with the number keys, and tools get selected. The button letters show over the hotbar while you hold a shoulder button.
- **Bounty board on a controller:** Y shows or hides the boss rumors and B hides them. A claims the first bounty that is ready. A hint at the bottom of the board shows these buttons.

## v0.25.2

See more of the world, read the controls at a glance, and get the next update in one click. Your save carries over as it is.

### New
- **Wide Eyes (new Survival skill):** zoom the view out to see more of the cave around you. Each rank lets you pull back further, up to 150% at rank 5. Zoom with Ctrl+mouse wheel, the - and = keys (you can rebind them in Keybinds), or the right stick on a controller. Your zoom level is remembered. Pixels stay sharp and the HUD stays the same size. It needs Pocket rank 2 and costs 2 points a rank. Reset skills gives the points back as usual.
- **View zoom in Settings > Graphics:** pick any zoom your Wide Eyes rank allows.
- **Controls strip:** a slim see-through bar at the bottom right shows the keys that matter right now, for example [E] shop at Wick's, [Space] pump, [F] eat when you are hungry, or [C] skills when you have points to spend. It shows controller buttons when you play on a pad, grows with UI scale, never covers the hotbar, and fades when you stand still. You can turn it off in Settings > General.
- **Updates from inside the app:** when a new version is out, a small bar says "Update available: vX". Click Update and Burrow downloads it, restarts and opens the new version. Your saves are not touched. (This stays switched off until the update address is set.)
- **Easier to find the bosses:** Wick's bounty board now has a rumor for each boss that is still alive, saying which layer it is in and roughly which way from home. Near a boss's lair you hear a low rumble and feel a light shake. The first time you get close, the lair gets a skull marker on your world map. In co-op, a lair one player finds is marked for everyone. The bosses themselves are unchanged.

### Changed
- **Hotbar quick-use:** pressing a number key or left-clicking a hotbar slot now uses food, drinks, potions, flasks and other consumables right away. Your pickaxe or other tool stays selected. Tools, weapons, blocks, rope and bombs still just get selected. You won't waste an item by accident: food is not eaten when you are full, drinks are not drunk when you are not thirsty, and a Health Flask is not used at full health.
- **Survival skill tree:** Plug now comes after Wide Eyes instead of straight after Pocket. Ranks you already have are kept.
- **Keybinds screen:** the list now has two columns, so every action fits.
- **Pad option:** "Pad: right stick zooms" in Settings > General (on by default; off when Left-click to mine is on, since the stick aims your digging then).
- **Version numbers:** everything now says v0.25.2.

### Fixed
- **Floating miner at Wick's:** the stall sat a few pixels too low in the grass, so your miner looked like he was floating in front of it. The stall now stands on the ground line.
- **Workbench:** its legs now stand on the grass (it was one pixel up).
- **Keybinds screen:** the last action no longer hides under the Reset button.
- **NEXT goal bar:** at Large and Handheld UI scale it no longer sits tiny on top of the bounty list. It now grows with the rest of the HUD.

## v0.25.1

Burrow is now a Windows app. Unzip it and run Burrow.exe, with no browser and no server window needed. The browser version still works, and your save carries over.

### New
- **Burrow for Windows:** Burrow.exe, with the Burrow icon and the window title "Burrow v0.25.1".
- **Window mode in Settings > Graphics (app only):** Windowed, Borderless or Fullscreen. In Windowed, Resolution sets the window size; if it's bigger than your screen, the window fills the screen. Alt+Enter switches fullscreen on and off.
- **Your saves stay safe:** the app keeps saves in your Windows user folder (AppData\Roaming\Burrow), never next to Burrow.exe, so you can replace or move the app folder without losing anything.
- **Import save:** the first time you open the app, the Choose-your-miner screen has an Import save button. Pick the save file you exported from the browser version (Esc > Export save) and you continue right where you were.
- **Co-op from the app:** Host game works without serve.py. Friends type the address it shows into Join game, or open it in a browser. A friend on a different version is told "Your friend is on vX, please update."
- **UI scale in Settings > Graphics:** Small, Normal, Large or Handheld. It makes the HUD, hotbar, messages and walk-up signs bigger. Handheld is for small screens like the Legion Go.

### Changed
- **New names:** "You've got mail" is now "Mail's here!", the death screen says BURIED, and the Shimmer Draught is now the Glimmer Draught. Potions you already have keep working.
- **Version numbers:** everything now says v0.25.1.

### Fixed
- **Legion Go and other 16:10 screens:** in Fit window, the game now fills the whole 2560 x 1600 screen edge to edge. Only Pixel-perfect keeps a thin frame.

## v0.25.0

Burrow now uses version numbers. This is v0.25.0. Small fix builds bump the last number (v0.25.1) and feature builds bump the middle one (v0.26.0). Your save carries over as it is.

### New
- **The game fills your screen:** the picture scales to fill the browser window at 16:9 on 1080p, 1440p and 4K screens. It uses the largest whole-number size that fits and only switches to a smooth fit when that would leave big borders. Pixels stay sharp, high-DPI screens included, and it rescales when you resize the window.
- **Fullscreen anywhere:** press Alt+Enter, use the Fullscreen button at the top right of the pause screen, or tick it in Settings.
- **Graphics tab in Settings:** next to General and Audio. It has Resolution, Screen size (Fit window or Pixel-perfect), Fullscreen, Screen shake, Particles (Low, Normal, High), Brightness and Show FPS. Your old settings stay as they were, and the new options start at their defaults.
- **Resolution choice:** Auto (matches your screen) or 1920 x 1080, 2560 x 1440, 3840 x 2160, Legion Go 2560 x 1600, 1920 x 1200 and 1280 x 800.
- **16:10 screens like the Legion Go:** the view grows a little taller instead of getting black bars, so you see more of the world and the HUD sits at the real screen edges. The whole Settings menu works with a controller: LB / RB switch tabs, the D-pad picks and changes options, and A toggles.
- **Key hints on signs:** every walk-up sign shows its name plus one short line with the key to press and what it does, for example [E] Shop, [E] Drink + fill or [G] Drink. The key is whatever you bound it to, and you see pad buttons when you play on a controller. Chests show their name and what they need. Only the nearest sign shows.
- **Older worlds now grow deeper too, so the Hollowhum shows up in your existing world.** A 720 x 260 world grows to 720 x 420 the first time you load it. Every tile you already had stays exactly as it was, the Magma runs deeper, and the Hollowhum starts at row 400 with its caves, deep chests, veins, puzzle vaults and Rift Shards. Passages open through the old bedrock floor. A copy of the world from before it grew is kept as a backup.
- **The Hollowhum on the world map:** the depth bar and legend list it in violet. It shows as ??? until someone has been down there.
- **Burrow has an icon:** the browser tab and bookmarks now show the Burrow icon.

### Changed
- **A compact home base again:** the shop, well, bounty board, campfire, workbench and stations sit close together, as they did before. Your house is right next to them. Signs pop up from closer in so they don't crowd each other. Existing saves move the base by themselves.
- **You start at your own front door:** a new game, a respawn, the Joint of Return and joining a friend's world all put you at your house door.
- **The controls line under the game is gone.** The controls are still in the H / F1 help.
- **Version numbers:** the corner label, pause screen, What's New card and browser tab now say Burrow v0.25.0.

### Fixed
- **Stash buttons fit their bar:** Deposit all / + Hotbar / Take all / Sort sit on one row and move to two rows if the text is wide. The help, "safe if you die" and upgrade lines wrap inside the panel.
- **Button text never spills out:** labels that are too wide for their button shrink or shorten instead. The bag, shop and crafting screens were all checked.
- **Clicks land in the right spot at any window size:** hover, shop, stash, dragging items, rivet aim and enemy hover all work.

## v0.24.4

*(was called art24d)*

### New
- **NO FRIENDLY FIRE:** players never hurt, pin, slow, knock back or stun each other. Rivets pass through teammates. Bombs and explosions never hurt players. A rock a friend loosens can't crush you (your own still can).
- **New worlds are 720 x 420:** much deeper than before. The rock layers roll up and down across the map instead of lying flat, so every dig looks different.
- **The Hollowhum:** a violet, humming floor at the very bottom of the world (row 400 and down). Wide caves, rich gold and magma veins, a deep chest in every few caves, and faster pests that pay more.
- **A new world every time:** each new world gets a random seed. Co-op friends always get the host's world.
- **Puzzle vaults:** sealed bedrock rooms with a small chamber in front. Three rune stones lie on the floor and the vault door shows the order. Step on them in that order and the door opens. Inside: a chest and 2 Rift Shards. The wrong stone resets the puzzle. In co-op anyone can solve it.
- **World Tiers 1-10:** Rift Shards drop from bosses, puzzle vaults and deep chests. Craft a **Rift Sigil** at the workbench (3 shards at Tier 1, one more per tier, never more than 6) and use it to open the portal. Higher tiers have faster, harder-hitting pests that give more XP and gold, and richer chests.
- **Teleport to a new world:** Esc > Teleport to a new world rolls a fresh world at the same tier. The pause menu shows how much of this world you have looted.
- **You keep everything:** a new world (portal, teleport, or New Burrow > Bring my miner) keeps all your items, stash, gold, level and skills. Your old world is saved as a backup first.
- **Prestige:** at level 50 you can prestige (two confirms). Your level and skills reset; each rank (up to 10) gives +5% XP, +3% gold, one more starting skill point, a glow tint and a badge next to your gold.
- **Your own house:** every miner gets a cabin next to the yard, with a cutaway inside: bed, stash and mailbox. Each player's stash is private; other players' stashes are locked.
- **Names:** pick a name the first time you play (Esc > Name to change it). It shows on your house and over your miner in co-op.
- **Mailbox:** a stack of (very fake) credit card offers, then a welcome parcel from the Burrow Postmaster: 150 gold, 3 Grub Jerky, 3 Well Water, 2 Canteen Tea, 2 Health Flask and 5 Rope.
- **Rivet Gun:** craft it at the workbench (copper and silver ingots and mite silk). It fires Rivets that pin a pest for 2 s (bosses only briefly). Mk2 fires almost twice as fast, Mk3 pierces 3 pests and pins longer. Rivets: 1 copper ore + 2 stone chunks for 10, or a pack of 10 from Wick.
- **Campfire:** stand by the home campfire while hurt to heal 1 heart every 10 s.
- **Safe yard:** bosses keep to their dens and walk home when you leave. The Bristle Sow's den is now well away from the base.
- **Enemy info on hover:** point at a pest to see what it is.
- **Wick's Glintery:** the shop has a new name and a new shopkeeper. Wick got a full redraw, in the same style as your miner, and the shop is a proper storefront with an awning, a counter and shelves. The bounty board got a redraw too.
- **Clearer loot:** everything you pick up now shows in a small list on the side of the screen, with its icon, name, how many you got and how many you have now. Gold shows too. It moves out of the way of your miner and enemies, then fades.
- **Chest cards:** every chest shows what was inside, one line per item. An empty chest now says so. Rare finds glow and play a chime.
- **Recent loot:** see your last 30 pickups, with how long ago, from the pack (Recent loot) or the pause menu.
- **Hover to read:** point at an item in the hotbar to see what it is and what it does. Point at an item on the ground to see its name.
- **Dig up:** hold W under a block to mine straight up.
- **Audio settings:** a sound section of its own in Settings: master volume plus separate sliders for music, cave ambience, sound effects and menu sounds.
- **Prestige badge:** the skills screen shows your prestige rank in the header.
- **Patch notes:** this list, in the pause menu. After an update you get a short "What's new" card once.
- **Hazard names:** point at spikes, fire or magma to see what they are.

### Changed
- **Spikes look dangerous now:** sharp steel points with rust-red tips on a dark base, with a small glint when you are close. You can't mistake them for a rock anymore.
- **Spike hits** flash the screen red and make their own metal sound. The first time you step on spikes you get a tip: jump over them or wear Spike Boots.
- **Skills screen:** easier to read. Skill names sit on dark labels, and colors show what you can learn now (green), what is maxed (gold) and what is still locked. A small key explains the colors.
- **Mining with the mouse** is off unless you turn it on. You can switch it from the pause menu.
- **Long item names** wrap onto a second line instead of being cut off ("Joint of / Return").
- **Chest prompt** sits beside the chest instead of on top of your miner, and only shows what you need (like a key).
- **Skill points** show as a small "1 skill pt [C]" chip instead of the old "Lv10 +1" that looked like a level bonus.
- **HUD:** the sun sits clear of the level box, and the goal tracker grows and wraps long names instead of cutting them off.
- **Signs** are small carved boards in the menu style. THE DIG sign fits its text and points at the shaft, and the Well has a sign.
- **One world size:** the small world option is gone.

### Fixed
- **Full pack:** items no longer vanish when your pack is full. Whatever doesn't fit drops on the ground with a red "Bag full" note, waits there, and you pick it up once you have room.
- **Spikes** only hurt when you actually step into them, not when you brush past the side.
- Picking up part of a stack no longer creates extra copies.
- **Stash:** Deposit all keeps your hotbar (Shift or + Hotbar moves it too), and stash tooltips no longer show through the pause menu.
- Old small saves upgrade to the big world even when the name prompt is open.

## v0.24.3

*(was called art24c)*

### New
- **Joint of Return and Bong of Destiny:** rare finds. The Joint takes you home and marks where you were; the Bong takes you back to that mark.
- **New skills screen:** three trees (Mining, Combat, Survival) with a detail card for every skill.
- **Reset skills** for gold.

### Changed
- Leveling is slower and now goes to level 50. Skills have more ranks.
- Crafting and storage upgrades cost more. The stash grows to 120 slots.
- M opens the map from anywhere.

### Fixed
- Your miner is always drawn in front of buildings.
- Stash buttons work, and Ctrl/Cmd+click moves a whole stack.
