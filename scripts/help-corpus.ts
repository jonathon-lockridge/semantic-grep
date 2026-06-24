/**
 * Original, hand-authored passages for semantic-grep. These are dedicated to the
 * public domain (CC0) — see data/SOURCE.md. They exist so the demo has a set of
 * passages with deliberate paraphrase variety: a query and its matching passage
 * often share NO keywords, which is exactly what makes the semantic match
 * impressive ("cancel subscription" -> "end your plan"). The bulk of the corpus
 * comes from Wikipedia (added by prepare-corpus.ts) for scale.
 */
export interface AuthoredPassage {
  title: string;
  text: string;
  category: string;
}

export const HELP_CORPUS: AuthoredPassage[] = [
  // ---- Billing & plans (paraphrase-rich; avoid the obvious keywords) ----
  {
    title: "Ending your plan",
    text: "To stop your recurring membership, open Billing and choose 'End my plan.' Access stays active until the current period closes, and after that no further charges are made to your card.",
    category: "Billing",
  },
  {
    title: "Stopping automatic payments",
    text: "You can turn off auto-renewal at any time. Once it is switched off, your account simply lapses at the end of the paid term instead of billing you again.",
    category: "Billing",
  },
  {
    title: "Getting your money back",
    text: "A full reimbursement is available within thirty days of purchase. Request it from the Orders page and the amount is returned to the original method of payment within a few business days.",
    category: "Billing",
  },
  {
    title: "Switching to a cheaper tier",
    text: "If the current package costs too much, you can move to a smaller option. The change takes effect on your next billing date and the price difference is prorated automatically.",
    category: "Billing",
  },
  {
    title: "Updating your card",
    text: "When your payment details change, go to Wallet and replace the stored card. We retry failed charges for three days before pausing the account.",
    category: "Billing",
  },
  {
    title: "Where to find receipts",
    text: "Every charge generates an invoice you can download as a PDF from the History section, useful for expense reports and reimbursement claims.",
    category: "Billing",
  },
  {
    title: "Why was I charged twice",
    text: "A duplicate-looking entry is usually a temporary authorization hold from your bank, not a real second charge; it disappears on its own within a week.",
    category: "Billing",
  },
  {
    title: "Free trial details",
    text: "New users get two weeks at no cost. We remind you by email before the trial converts so you are never surprised by a bill.",
    category: "Billing",
  },
  {
    title: "Student and nonprofit discounts",
    text: "Reduced pricing is offered to learners in full-time education and to registered charities; send proof of status to support and we apply the lower rate.",
    category: "Billing",
  },
  {
    title: "Paying yearly instead of monthly",
    text: "Choosing the annual option lowers the effective monthly cost by about a sixth compared with paying every thirty days.",
    category: "Billing",
  },

  // ---- Account & sign-in ----
  {
    title: "Trouble getting into your account",
    text: "If the system will not let you in, use the 'Can't access your account?' link to receive a one-time link by email and set fresh credentials.",
    category: "Account",
  },
  {
    title: "Changing the email on file",
    text: "Your contact address can be updated under Profile. We send a confirmation to both the old and new inbox to make sure the change is genuine.",
    category: "Account",
  },
  {
    title: "Turning on extra login protection",
    text: "For stronger security, enable a second verification step so that a code from your phone is required in addition to your usual secret phrase.",
    category: "Account",
  },
  {
    title: "Closing your account for good",
    text: "Permanent removal erases your profile and content after a thirty-day grace window during which you can still change your mind.",
    category: "Account",
  },
  {
    title: "Merging two profiles",
    text: "If you accidentally registered twice, we can combine the records so your history and saved items live under a single login.",
    category: "Account",
  },
  {
    title: "Username versus display name",
    text: "The handle you sign in with is fixed, but the public name shown to others can be edited as often as you like.",
    category: "Account",
  },
  {
    title: "Not receiving the verification message",
    text: "When the confirmation note never arrives, check the spam folder, make sure the address is spelled correctly, and add our domain to your safe-senders list.",
    category: "Account",
  },
  {
    title: "Signing out everywhere",
    text: "If you used a shared or borrowed device, you can revoke every active session at once from the Security page so no one stays logged in.",
    category: "Account",
  },

  // ---- Privacy & security ----
  {
    title: "How your information is protected",
    text: "Personal details are scrambled both while stored and while moving across the network, and we never sell them to outside companies.",
    category: "Privacy",
  },
  {
    title: "Downloading a copy of your data",
    text: "You are entitled to export everything we hold about you as a single archive; request it from Privacy settings and we email a link when it is ready.",
    category: "Privacy",
  },
  {
    title: "Controlling who sees your activity",
    text: "Visibility controls let you decide whether your actions are public, limited to connections, or hidden entirely from other people.",
    category: "Privacy",
  },
  {
    title: "Reporting a suspicious message",
    text: "If a note claims to be from us but asks for your secret phrase, treat it as a scam and forward it to our abuse team rather than replying.",
    category: "Privacy",
  },
  {
    title: "What we do with cookies",
    text: "Small tracking files remember your preferences and keep you signed in; you can clear or limit them in your browser without losing your account.",
    category: "Privacy",
  },
  {
    title: "Children and the service",
    text: "The platform is intended for adults, and we remove profiles that appear to belong to people below the minimum age once they are flagged.",
    category: "Privacy",
  },
  {
    title: "Who can read your private notes",
    text: "Content you mark as confidential is visible only to you; staff cannot browse it and access is logged when troubleshooting requires it.",
    category: "Privacy",
  },

  // ---- Technical / troubleshooting ----
  {
    title: "The program closes unexpectedly",
    text: "When the application shuts down on its own, empty its temporary files, install the newest version, and reboot the machine before launching it again.",
    category: "Troubleshooting",
  },
  {
    title: "Pages load slowly or not at all",
    text: "Sluggish loading is often a weak connection; try a wired link, move closer to the router, or pause other downloads that eat bandwidth.",
    category: "Troubleshooting",
  },
  {
    title: "Nothing happens when I click",
    text: "If buttons feel unresponsive, a stale script is usually to blame; a hard refresh that bypasses the cache normally brings everything back to life.",
    category: "Troubleshooting",
  },
  {
    title: "Video will not play",
    text: "Playback problems are commonly caused by an outdated browser or an aggressive ad blocker; updating the former and pausing the latter resolves most cases.",
    category: "Troubleshooting",
  },
  {
    title: "Uploads keep failing",
    text: "A file that refuses to attach may be too large or in an unsupported format; compress it or convert it to a common type and try once more.",
    category: "Troubleshooting",
  },
  {
    title: "Everything looks tiny",
    text: "To make on-screen elements easier to read, raise the display scaling in your appearance preferences or use the magnification shortcut.",
    category: "Troubleshooting",
  },
  {
    title: "Notifications stopped arriving",
    text: "If alerts go quiet, confirm they are permitted at the operating-system level and that you have not muted the channel inside your profile.",
    category: "Troubleshooting",
  },
  {
    title: "The site looks broken",
    text: "Misaligned layouts and missing images usually mean a half-loaded page; clearing stored data and reloading restores the correct appearance.",
    category: "Troubleshooting",
  },

  // ---- Orders, shipping, returns ----
  {
    title: "Tracking where your parcel is",
    text: "Once an order leaves the warehouse you receive a code that shows the package's progress and the expected day it reaches your door.",
    category: "Orders",
  },
  {
    title: "Sending something back",
    text: "Unwanted items can be returned within the first month as long as they are unused; print the prepaid label and drop the box at any carrier point.",
    category: "Orders",
  },
  {
    title: "My delivery never showed up",
    text: "If a shipment is marked delivered but you cannot find it, check with neighbours and the building office before we open a lost-package investigation.",
    category: "Orders",
  },
  {
    title: "Changing the destination address",
    text: "You can redirect a purchase only before it ships; afterwards the courier must handle the diversion, which may add a day or two.",
    category: "Orders",
  },
  {
    title: "Items arrived damaged",
    text: "When goods turn up broken, photograph the contents and packaging and send the pictures so we can dispatch a replacement at no charge.",
    category: "Orders",
  },
  {
    title: "Combining several orders",
    text: "Multiple purchases made within a short window can sometimes be packed together to save on postage if they have not yet been prepared.",
    category: "Orders",
  },
  {
    title: "How long until it gets here",
    text: "Standard handling takes one to two days, after which transit time depends on your region; remote areas naturally wait a little longer.",
    category: "Orders",
  },

  // ---- Using the product / features ----
  {
    title: "Working with others on the same project",
    text: "Invite teammates by email and they can view or edit shared spaces in real time, with everyone's changes appearing as they happen.",
    category: "Features",
  },
  {
    title: "Finding something you saved earlier",
    text: "Use the search bar at the top to locate any item by its words, and narrow the list with filters for date, type, or owner.",
    category: "Features",
  },
  {
    title: "Undoing a mistake",
    text: "Almost every action can be reversed; press the standard undo shortcut, or restore an earlier version from the document's history.",
    category: "Features",
  },
  {
    title: "Working without a connection",
    text: "Recent items stay available even when you are offline, and your edits sync automatically the moment the network returns.",
    category: "Features",
  },
  {
    title: "Sharing a link to your work",
    text: "Generate a view-only or editable link so people without an account can still open what you made, and revoke it whenever you wish.",
    category: "Features",
  },
  {
    title: "Keyboard shortcuts",
    text: "Power users can move far faster with hotkeys; press the question mark anywhere to bring up the full list of available combinations.",
    category: "Features",
  },
  {
    title: "Organizing with folders and tags",
    text: "Group related material into folders for structure and add colored labels so the same item can belong to several themes at once.",
    category: "Features",
  },
  {
    title: "Switching between light and dark appearance",
    text: "A softer night-time look is available; toggle it manually or let it follow your device's schedule so it dims after sunset.",
    category: "Features",
  },
  {
    title: "Exporting to other formats",
    text: "Your content can leave the platform as a document, spreadsheet, or image so you can use it in other tools or print it.",
    category: "Features",
  },
  {
    title: "Getting started for the first time",
    text: "New members are walked through a short setup that imports existing material and suggests a few first steps tailored to their goals.",
    category: "Features",
  },

  // ---- Everyday science explainers ----
  {
    title: "Why the daytime sky is blue",
    text: "Air molecules scatter the shorter, bluer wavelengths of sunlight far more than the longer red ones, so light reaching our eyes from all directions looks blue.",
    category: "Science",
  },
  {
    title: "How green leaves feed a plant",
    text: "Using energy from the sun, foliage combines water drawn up from the roots with carbon dioxide from the air to build sugars, releasing oxygen as a by-product.",
    category: "Science",
  },
  {
    title: "What causes the changing seasons",
    text: "The planet's tilt means each hemisphere leans toward the sun for part of the year and away for the rest, varying the strength and length of daylight.",
    category: "Science",
  },
  {
    title: "Why ice floats on water",
    text: "When water freezes its molecules lock into an open lattice that takes up more room, making the solid less dense than the liquid beneath it.",
    category: "Science",
  },
  {
    title: "How rainbows form",
    text: "Sunlight bends and splits as it enters and leaves tiny raindrops, separating into its component colors and arcing back toward an observer.",
    category: "Science",
  },
  {
    title: "Why we have day and night",
    text: "The Earth turns once roughly every twenty-four hours, so any given place rotates into sunlight and then back into shadow.",
    category: "Science",
  },
  {
    title: "What makes thunder rumble",
    text: "A lightning bolt heats the surrounding air so fast that it expands explosively, and the resulting shock wave is the sound we hear.",
    category: "Science",
  },
  {
    title: "How magnets attract metal",
    text: "Inside a magnet countless tiny atomic currents line up the same way, producing a field that tugs on certain metals like iron.",
    category: "Science",
  },
  {
    title: "Why the moon seems to change shape",
    text: "We always see the half of the moon lit by the sun, and as it orbits us the slice of that lit face turned toward Earth grows and shrinks.",
    category: "Science",
  },
  {
    title: "What keeps a plane in the air",
    text: "A wing is shaped so that air moving over it lowers the pressure above, and the difference with the higher pressure below lifts the aircraft up.",
    category: "Science",
  },

  // ---- Health & everyday life ----
  {
    title: "Feeling sleepy after a big meal",
    text: "A heavy lunch sends blood toward digestion and triggers hormones that promote rest, which is why drowsiness often follows a large midday plate.",
    category: "Wellbeing",
  },
  {
    title: "Why you yawn when others do",
    text: "Seeing someone open their mouth wide tends to set off the same reflex in onlookers, a contagious response linked to empathy and shared attention.",
    category: "Wellbeing",
  },
  {
    title: "Staying hydrated through the day",
    text: "Sipping fluids steadily keeps energy and concentration up; thirst is a late signal, so it helps to drink before you actually feel parched.",
    category: "Wellbeing",
  },
  {
    title: "Getting better sleep",
    text: "Dimming lights, avoiding screens late, and keeping a steady bedtime help the body wind down and fall asleep more easily.",
    category: "Wellbeing",
  },
  {
    title: "Why stretching feels good",
    text: "Lengthening tight muscles eases built-up tension and improves blood flow, leaving the body looser and the mind a little calmer.",
    category: "Wellbeing",
  },
  {
    title: "The point of washing your hands",
    text: "Scrubbing with soap lifts germs off the skin so they rinse away, which is one of the simplest ways to avoid passing illness along.",
    category: "Wellbeing",
  },
  {
    title: "Why we feel cold and shiver",
    text: "When the body loses heat, rapid muscle twitches generate warmth, and blood pulls back from the skin to protect the core temperature.",
    category: "Wellbeing",
  },
  {
    title: "Calming your nerves before speaking",
    text: "Slow, deep breaths and a moment of preparation lower the racing heartbeat that comes with stage fright and steady the voice.",
    category: "Wellbeing",
  },

  // ---- How technology works ----
  {
    title: "What happens when you visit a website",
    text: "Your device asks a directory for the address of the site, connects to that distant computer, and downloads the page so the browser can draw it.",
    category: "Technology",
  },
  {
    title: "How a password keeps you safe",
    text: "A secret phrase proves you are the rightful owner, and storing it only as a scrambled fingerprint means even leaked records do not reveal it.",
    category: "Technology",
  },
  {
    title: "Why a stronger phrase matters",
    text: "Longer, less predictable secrets take vastly more guesses to crack, so a short common word offers almost no protection at all.",
    category: "Technology",
  },
  {
    title: "What the cloud actually is",
    text: "Storing files in the cloud simply means keeping them on someone else's well-maintained computers, reachable from anywhere over the internet.",
    category: "Technology",
  },
  {
    title: "How wireless internet reaches your laptop",
    text: "A nearby box turns your network connection into radio signals, and your device translates those waves back into the data it needs.",
    category: "Technology",
  },
  {
    title: "Why software needs updates",
    text: "Revisions patch newly found weaknesses and fix mistakes, so keeping programs current is one of the best defenses against attackers.",
    category: "Technology",
  },
  {
    title: "What a search engine does",
    text: "It quietly reads enormous numbers of pages in advance, builds an index of their words and meaning, and ranks the best matches when you ask.",
    category: "Technology",
  },
  {
    title: "How a battery stores energy",
    text: "Charging pushes particles to one side of the cell, and using the device lets them flow back, releasing the stored energy as electric current.",
    category: "Technology",
  },
  {
    title: "Why phones get warm while charging",
    text: "Moving energy into the battery and running the processor both produce waste heat, so the device feels warm until the load eases.",
    category: "Technology",
  },
  {
    title: "What makes one computer faster than another",
    text: "Speed comes from how quickly the processor works, how much fast memory it has, and how smartly its software avoids unnecessary work.",
    category: "Technology",
  },
];
