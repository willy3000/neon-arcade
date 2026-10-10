# Animation pipeline and honest coverage

`characters.png` contains 365 genuine raster animation frames from Riley Gombart's CC BY 3.0 pack. Feet rotate independently from the torso. Movement animation advances by ground distance rather than a fixed idle loop; strafing and reverse travel select the appropriate gait and phase. Torso and muzzle use the same aim angle as hit detection. A 70ms crossfade softens changes of action sequence without blocking input.

| State | Live implementation |
|---|---|
| Idle | Authored 20-frame weapon-specific breathing sequence. |
| Walk / run / sprint | 20-frame moving torso plus separate 20-frame walking/running feet; phase driven by travel. |
| Strafe / reverse | Authored left/right feet; reverse phase for backward travel while torso stays aimed. |
| Rifle, pistol, shotgun fire | Three authored firing frames, physical recoil, matched muzzle origin, ejected casing, sample and flash. Other range firearms adapt the corresponding weapon body. |
| Reload | 15 handgun / 20 rifle or shotgun frames normalized to the actual reload duration; ammunition transfers at completion. |
| Quick knife combo / heavy / finisher | Authored 15-frame knife sequence normalized to startup, active frame and recovery; hit detection fires at .12s quick / .24s heavy, with escalating damage and directional reach. |
| Slide | Moving torso/feet sequences plus articulated crouch/compression and preserved momentum. |
| Roll / dive | Moving torso and feet remain animated; torso twist, limb compression, body height and landing respond to action phase. Protection uses the same action age. This is an adapted layered rig, not an authored full-body roll/dive sheet. |
| Vault | Separate feet/torso with a rising body and shrinking ground shadow, position interpolated between validated endpoints. |
| Damage | Directional displacement, torso flinch, stagger, sound and impact particles. |
| Healing | Adapted inspection/reload pose while the timed stim is active. |
| Death | Grounded collapsed torso pose, hidden feet, reduced scale/tint. No authored death sequence is claimed. |
| Grenade | Live trajectory/fuse/area damage and audio; no dedicated character throw sequence yet. |

Rook receives a desaturated olive treatment, amber identification stripe and equipment overlay. Enemy tints, shoulder markings and the shield silhouette distinguish hostiles. These are adaptations of the licensed character base, not a claim that a completely original AAA soldier rig was commissioned.

Animation events and simulation share state age: firing frame immediately accompanies a shot; melee's active time causes damage once; reload and healing complete at their actual timers. Heavy melee applies a 25ms hitstop, while buffered inputs preserve the next action. Projectile origin tests against cover prevent visuals from bypassing a collider.

Missing from the original full-campaign animation list: dedicated lowered-ready/scanning/equipment-adjusting variants, authored landing/stumble/death/grenade/weapon-swap clips, climbing, revive, gadget-specific deployment, surface-specific clothing foley, foot IK and custom skeletal exports. The current clip blending is not a general skeletal blend-tree or inverse-kinematics implementation. These are explicit production gaps, not hidden placeholders.

Next art pass should prioritize a dedicated grenade throw, ground tumble/death and a clearer bespoke Rook helmet/outfit before producing later chapters.

## Campaign additions (10 October 2026)

New soldier types reuse the same licensed rig with their gun's torso set (handgun, rifle or shotgun frames) or the knife set for rushers and ghosts, plus per-type tints and code-drawn overlays: breacher plates, grenadier bandolier, gunner ammo box, rocketeer launch tube, elite visor lights, Wraith visor and shimmer. Ghosts fade with distance and become solid up close, mid-strike, when hit or flashed. Sentry guns, bomb drones, the Bulwark carrier and the Warden mech are drawn entirely in code (rotating turrets and barrels, stepping legs, barrier hex ring, EMP sparks); they are not sprite animations. Two-slot weapon swaps, mines, decoys (a cyan hologram of Rook's rig) and deployable cover reuse existing layers. No new authored character sheets were added.
