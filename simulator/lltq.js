"use strict";
const [rebuildContent, generateReport] = (function() {

/* State */
/*
 *	Using a functional approach, the model of the game is based on an array of state objects.
 *  Generally, getters ('read' here) must not mutate the state, and setters return a clone
 *	of the state which as been appropriately mutated. Each state in the array is the result
 *	after the in-game week for that index.
 */
const [State, cloneState] = (function() {

		function State() {
			return {
				'moodStats': [0, 0, 0, 0, 0],
				'miscStats': [0, 0, 0, 0, 0],
				'outfitsUnlocked': [false, false, false, false, false, false, false, false, false, false, false, false, false, false],
				'currentOutfit': -1,
				'skillStats': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				'flags': {}
			};
		};

		function cloneState(old) {
			return {
				'moodStats': Array.from(old.moodStats),
				'miscStats': Array.from(old.miscStats),
				'outfitsUnlocked': Array.from(old.outfitsUnlocked),
				'currentOutfit': old.currentOutfit,
				'skillStats': Array.from(old.skillStats),
				'flags': Object.assign({}, old.flags)
			};
		};

	return [State, cloneState];
})();

/* Mood */
/*
 *	I'm using IIFE scopes to group the 'global' functions and reduce the exposure of helper
 *	functions here and below.
 */
const [offsetMood, readMoodAxis, determineMood, determineMoodName] = (function() {

	function tokenize(out, code) {
		if (out.length === 0 || maps.mood.hasOwnProperty(out[out.length - 1].substring(out[out.length - 1].length - 1))) {
			if (maps.mood.hasOwnProperty(code)) {
				return out.concat('1' + code);
			}
			return out.concat(code);
		}
		if (maps.mood.hasOwnProperty(code) && out[out.length - 1] === '-') {
			out[out.length - 1] += '1' + code;
		}
		else {
			out[out.length - 1] += code;
		}
		return out;
	};

	function splitCode(code) {
		return [Number.parseInt(code.substring(0, code.length - 1)), code.substring(code.length - 1)];
	};

	function offsetSingleMoodInPlace(s, offset) {
		const [amount, axis] = offset;
		const index = maps.mood[axis].index;
		const unit = maps.mood[axis].unit;
		if (amount < 0 && unit * s.moodStats[index] < 0) {
			return s;
		}
		s.moodStats[index] += amount * unit;
		if (amount < 0 && unit * s.moodStats[index] < 0) {
			s.moodStats[index] = 0;
		}
		return s;
	};

	function clampMoodInPlace(s) {
		s.moodStats.forEach((x, n, a) => {
			if (n === 0) {
				return;
			}
			if (x < -5) {
				a[n] = -5
			}
			else if (x > 5) {
				a[n] = 5
			}
		});
		return s;
	};

	function compareAxes(a, bx, bn) {
		if (bn === 0) {
			return a;
		}
		const [ax, an] = a;
		if (ax > bx) {
			return a;
		}
		else if (bx > ax) {
			return [bx, bn];
		}
		else if (an < bn) {
			return a;
		}
		return [bx, bn];
	};

	function determineMoodString(s) {
		const shorts = Object.keys(maps.mood);
		return s.moodStats.reduce((ret, v, n) => {
			if (v === 0) {
				return ret;
			}
			let a = Math.abs(v);
			if (a > 1) {
				ret += a;
			}
			if (v > 0) {
				return ret + shorts[2 * n];
			}
			else {
				return ret + shorts[2 * n + 1];
			}
		}, '');
	};

	function offsetMood(old, offset) {
		let ret = cloneState(old);
		const codes = offset.split('').reduce(tokenize, []).map(splitCode);
		ret = codes.reduce(offsetSingleMoodInPlace, ret);
		return clampMoodInPlace(ret);
	};

	function readMoodAxis(s, key) {
		return s.moodStats[maps.mood[key].index] * maps.mood[key].unit;
	};

	function determineMood(s) {
		const q = s.moodStats;
		const r = Object.keys(maps.mood);
		if (q[0] > 0) { // Injured
			return r[0];
		}
		const [value, index] = q.map(Math.abs).reduce(compareAxes, [0, -1]);
		if (index < 0) { // Neutral
			return r[1];
		}
		return (q[index] > 0) ? r[2 * index] : r[2 * index + 1];
	};

	function determineMoodName(s) {
		return maps.mood[determineMood(s)].name + ' (' + determineMoodString(s) + ')';
	};

	return [offsetMood, readMoodAxis, determineMood, determineMoodName];
})();

/* Misc */
const [offsetMisc, readMisc, determineMiscString] = (function() {

	function offsetMiscInPlace(s, amount, key) {
		s.miscStats[maps.misc[key].index] += amount;
		return s;
	};

	function offsetMisc(old, dict) {
		const ret = cloneState(old);
		Object.entries(dict).forEach(x => {
			const [key, amount] = x;
			offsetMiscInPlace(ret, amount, key);
		});
		return ret;
	};

	function readMisc(s, key) {
		return s.miscStats[maps.misc[key].index];
	};

	function determineMiscString(s) {
		return Object.entries(maps.misc).map(x => x[0] + ': ' + s.miscStats[x[1].index]).join(', ')
	};

	return [offsetMisc, readMisc, determineMiscString];
})();

/* Outfit */
const [readCurrentOutfit, equipOutfit, readUnlockedOutfits, readOutfitName] = (function() {

	function outfitMatch(id) {
		return x => {
			const [shortName, value] = x;
			return value.index === id;
		};
	};

	function objectZip(s) {
		return x => {
			const [shortName, value] = x;
			return [shortName, (value.index < 0) ? true : s.outfitsUnlocked[value.index]];
		};
	};

	function unpackUnlocked([shortName, unlocked]) {
		return unlocked;
	};

	function unpackShortName([shortName, unlocked]) {
		return shortName;
	};

	function readCurrentOutfit(s) {
		return Object.entries(maps.outfit).find(outfitMatch(s.currentOutfit))[0];
	};

	function equipOutfit(old, key) {
		const ret = cloneState(old);
		ret.currentOutfit = maps.outfit[key].index;
		return ret;
	};

	function readUnlockedOutfits(s) {
		return Object.entries(maps.outfit).map(objectZip(s)).filter(unpackUnlocked).map(unpackShortName);
	}

	function readOutfitName(shortName) {
		return maps.outfit[shortName].name;
	}

	return [readCurrentOutfit, equipOutfit, readUnlockedOutfits, readOutfitName];
})();

/* Skills */
const [readSubgroup, safeTrainSkills, readSkill, readUnlockedSkills, getSkillOptionText] = (function() {

	function sum(s, x) {
		return s + x;
	};

	function vMin(x) {
		return x.reduce((a, b) => Math.min(a, b));
	}

	function readSkillById(s, id) {
		return s.skillStats[id];
	};

	function readSkillMoodMod(m, shortName) {
		return maps.mood[m].subgroupOffsets.find(x => x.outfit === maps.skill[shortName].outfit);
	};

	function trainSkill(target, source, shortName) {
		const subgroupVals = maps.skill[shortName].subgroup.map(n => readSkillById(source, n));
		const groupVals = maps.skill[shortName].group.map(n => readSkillById(source, n));
		const m = determineMood(source);
		const min = vMin(maps.skill[shortName].subgroup.map(n => readSkillById(target, n)));
		const [cap, canUnlock] = (min < 25) ? [50, true] : [100, false];
		const subgroupBonus = subgroupVals.reduce(sum) * 0.01;
		const groupBonus = groupVals.reduce(sum) * 0.001;
		const moodOffset = readSkillMoodMod(m, shortName);
		const moodMod = (moodOffset === undefined) ? 2 : 2 + moodOffset.value;
		const gain = Math.max(0, 5 * (moodMod + subgroupBonus + groupBonus));
		const id = maps.skill[shortName].index;
		target.skillStats[id] = Math.min(cap, target.skillStats[id] + gain);
		return canUnlock;
	};

	function unlockOutfitInPlace(s, s1, s2, c1, c2) {
		let min;
		if (c1) {
			min = vMin(maps.skill[s1].subgroup.map(n => s.skillStats[n]));
			if (min >= 25) {
				s.outfitsUnlocked[maps.outfit[maps.skill[s1].outfit].index] = true;
			}
		}
		if (c2 && maps.skill[s1].outfit !== maps.skill[s2].outfit) {
			min = vMin(maps.skill[s2].subgroup.map(n => s.skillStats[n]));
			if (min >= 25) {
				s.outfitsUnlocked[maps.outfit[maps.skill[s2].outfit].index] = true;
			}
		}
	};

	function specialFaithCheck(s, skill1, skill2) {
		if ((maps.skill[skill1].outfit === 'faith' || maps.skill[skill2].outfit === 'faith') &&
			readSkill(s, 'sense') >= 80 &&
			!readFlag(s, 'Leadership') &&
			!readFlag(s, 'Priestess')) {
			return addFlag(s, 'Priestess');
		}
		return s;
	};

	function trainSkills(old, skill1, skill2) {
		let ret = cloneState(old);
		const check1 = trainSkill(ret, old, skill1);
		const check2 = trainSkill(ret, old, skill2);
		unlockOutfitInPlace(ret, skill1, skill2, check1, check2);
		ret = specialFaithCheck(ret, skill1, skill2);
		return ret;
	};

	function skillMatchesOutfit(s, shortName) {
		return maps.skill[shortName].outfit === readCurrentOutfit(s);
	};

	function lumenSkillsActive(s) {
		return readFlag(s, 'Lumen');
	}

	function readSkillName(shortName) {
		return maps.skill[shortName].name;
	};

	function readSubgroup(s, name) {
		return Object.entries(maps.skill).filter(x => x[1].outfit === name).map(x => readSkill(s, x[0])).reduce(sum);
	};

	function safeTrainSkills(old, skill1, skill2) {
		return (skill1 === 'none' || skill2 === 'none') ? old : trainSkills(old, skill1, skill2);
	};

	function readSkill(s, shortName, ignoreOutfit = false) {
		return (ignoreOutfit || !skillMatchesOutfit(s, shortName)) ? s.skillStats[maps.skill[shortName].index] : 10 + Math.min(100, s.skillStats[maps.skill[shortName].index]);
	};

	function readUnlockedSkills(s) {
		return Object.entries(maps.skill).filter(x => x[1].outfit !== 'lumen' || lumenSkillsActive(s)).map(x => x[0]);
	};

	function getSkillOptionText(m, shortName) {
		const mod = readSkillMoodMod(m, shortName);
		return (mod === undefined) ? readSkillName(shortName) : readSkillName(shortName) + ' (' + mod.value + ')';
	};

	return [readSubgroup, safeTrainSkills, readSkill, readUnlockedSkills, getSkillOptionText];
})();

/* Flags */
const [addFlag, readFlag, readAndFlags, readOrFlags, readAndNotFlags, readOrNotFlags] = (function() {

	const flagAccessor = Object.freeze({'enumerable': true});

	function addFlag(old, flag) {
		const ret = cloneState(old);
		Object.defineProperty(ret.flags, flag, flagAccessor);
		return ret;
	};

	function readFlag(s, flag) {
		return s.flags.hasOwnProperty(flag);
	};

	function readAndFlags(s, flags) {
		return flags.every(x => s.flags.hasOwnProperty(x));
	};

	function readOrFlags(s, flags) {
		return flags.some(x => s.flags.hasOwnProperty(x));
	};

	function readAndNotFlags(s, flags) {
		return flags.every(x => !s.flags.hasOwnProperty(x));
	};

	function readOrNotFlags(s, flags) {
		return flags.some(x => !s.flags.hasOwnProperty(x));
	};

	return [addFlag, readFlag, readAndFlags, readOrFlags, readAndNotFlags, readOrNotFlags];
})();

const emptyDocumentCallback = (s, n, c) => new DocumentFragment();

const emptyGeneration = (s, n, c) => [s, emptyDocumentCallback(s, n, c)];

const maps = {
	'mood': {
		'I': {'index': 0, 'unit': 1,	'name': 'Injured',		'subgroupOffsets': [{'outfit': 'agility', 'value': -3}, {'outfit': 'weapons', 'value': -3}, {'outfit': 'athletics', 'value': -3}, {'outfit': 'animal', 'value': -3}]},
		'N': {'index': -1,'unit': 0,	'name': 'Neutral',		'subgroupOffsets': []},
		'A': {'index': 1, 'unit': 1,	'name': 'Angry',		'subgroupOffsets': [{'outfit': 'royal', 'value': -1}, {'outfit': 'expression', 'value': -1}, {'outfit': 'animal', 'value': -1}, {'outfit': 'medicine', 'value': -1}, {'outfit': 'weapons', 'value': 1}, {'outfit': 'military', 'value': 1}]},
		'F': {'index': 1, 'unit': -1,	'name': 'Afraid',		'subgroupOffsets': [{'outfit': 'royal', 'value': -1}, {'outfit': 'weapons', 'value': -1}, {'outfit': 'intrigue', 'value': -1}, {'outfit': 'military', 'value': -1}, {'outfit': 'agility', 'value': 1}, {'outfit': 'faith', 'value': 1}]},
		'C': {'index': 2, 'unit': 1,	'name': 'Cheerful',		'subgroupOffsets': [{'outfit': 'military', 'value': -2}, {'outfit': 'weapons', 'value': -1}, {'outfit': 'intrigue', 'value': -1}, {'outfit': 'conversation', 'value': 1}, {'outfit': 'athletics', 'value': 1}]},
		'D': {'index': 2, 'unit': -1,	'name': 'Depressed',	'subgroupOffsets': [{'outfit': 'conversation', 'value': -2}, {'outfit': 'royal', 'value': -1}, {'outfit': 'athletics', 'value': -1}, {'outfit': 'expression', 'value': 1}, {'outfit': 'animal', 'value': 1}]},
		'W': {'index': 3, 'unit': 1,	'name': 'Willful',		'subgroupOffsets': [{'outfit': 'royal', 'value': -2}, {'outfit': 'history', 'value': -2}, {'outfit': 'economics', 'value': -2}, {'outfit': 'intrigue', 'value': 1}, {'outfit': 'military', 'value': 1}, {'outfit': 'lumen', 'value': 1}]},
		'Y': {'index': 3, 'unit': -1,	'name': 'Yielding',		'subgroupOffsets': [{'outfit': 'weapons', 'value': -3}, {'outfit': 'lumen', 'value': -3}, {'outfit': 'royal', 'value': 1}, {'outfit': 'history', 'value': 1}, {'outfit': 'faith', 'value': 1}]},
		'P': {'index': 4, 'unit': 1,	'name': 'Pressured',	'subgroupOffsets': [{'outfit': 'conversation', 'value': -1}, {'outfit': 'history', 'value': -1}, {'outfit': 'economics', 'value': -1}, {'outfit': 'athletics', 'value': 1}, {'outfit': 'faith', 'value': 1}]},
		'L': {'index': 4, 'unit': -1,	'name': 'Lonely',		'subgroupOffsets': [{'outfit': 'royal', 'value': -1}, {'outfit': 'intrigue', 'value': -1}, {'outfit': 'faith', 'value': -1}, {'outfit': 'conversation', 'value': 1}, {'outfit': 'medicine', 'value': 1}]}
	},
	'misc': {
		'K':  {'index': 0, 'name': ''},
		'Ca': {'index': 1, 'name': ''},
		'Na': {'index': 2, 'name': ''},
		'G':  {'index': 3, 'name': 'G'},
		'R':  {'index': 4, 'name': ''}
	},
	'outfit': {
		'base':			{'index': -1,	'name': 'Boarding School Uniform'},
		'royal':		{'index': 0,	'name': 'Coronet'},
		'conversation':	{'index': 1,	'name': 'Tea Dress'},
		'expression':	{'index': 2,	'name': 'Toga'},
		'agility':		{'index': 3,	'name': 'Tutu'},
		'weapons':		{'index': 4,	'name': 'Tabard'},
		'athletics':	{'index': 5,	'name': 'Exercise Gear'},
		'animal':		{'index': 6,	'name': 'Hunt Coat'},
		'history': 		{'index': 7,	'name': "Scholar's Gown"},
		'intrigue': 	{'index': 8,	'name': 'Catsuit'},
		'medicine':		{'index': 9,	'name': "Nurse's Gown"},
		'economics':	{'index': 10,	'name': 'Tuxedo'},
		'military':		{'index': 11,	'name': 'Uniform'},
		'faith':		{'index': 12,	'name': 'Priestess Robe'},
		'lumen':		{'index': 13,	'name': 'Magical Girl'}
	},
	'skill': {
		'composure':{'index': 0,	'outfit': 'royal',			'subgroup': [0, 1, 2],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Composure'},
		'elegance':	{'index': 1,	'outfit': 'royal',			'subgroup': [0, 1, 2],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Elegance'},
		'presence':	{'index': 2,	'outfit': 'royal',			'subgroup': [0, 1, 2],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Presence'},
		'public':	{'index': 3,	'outfit': 'conversation',	'subgroup': [3, 4, 5],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Public Speaking'},
		'court':	{'index': 4,	'outfit': 'conversation',	'subgroup': [3, 4, 5],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Court Manners'},
		'flattery':	{'index': 5,	'outfit': 'conversation',	'subgroup': [3, 4, 5],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Flattery'},
		'decorate':	{'index': 6,	'outfit': 'expression',		'subgroup': [6, 7, 8],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Decoration'},
		'instrument':{'index': 7,	'outfit': 'expression',		'subgroup': [6, 7, 8],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Instrument'},
		'voice':	{'index': 8,	'outfit': 'expression',		'subgroup': [6, 7, 8],		'group': [0, 1, 2, 3, 4, 5, 6, 7, 8],	'name': 'Voice'},
		'dance':	{'index': 9,	'outfit': 'agility',		'subgroup': [9, 10, 11],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Dance'},
		'reflexes':	{'index': 10,	'outfit': 'agility',		'subgroup': [9, 10, 11],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Reflexes'},
		'flexible':	{'index': 11,	'outfit': 'agility',		'subgroup': [9, 10, 11],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Flexibility'},
		'swords':	{'index': 12,	'outfit': 'weapons',		'subgroup': [12, 13, 14],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Swords'},
		'archery':	{'index': 13,	'outfit': 'weapons',		'subgroup': [12, 13, 14],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Archery'},
		'polearms':	{'index': 14,	'outfit': 'weapons',		'subgroup': [12, 13, 14],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Polearms'},
		'running':	{'index': 15,	'outfit': 'athletics',		'subgroup': [15, 16, 17],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Running'},
		'swimming':	{'index': 16,	'outfit': 'athletics',		'subgroup': [15, 16, 17],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Swimming'},
		'climbing':	{'index': 17,	'outfit': 'athletics',		'subgroup': [15, 16, 17],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Climbing'},
		'horses':	{'index': 18,	'outfit': 'animal',			'subgroup': [18, 19, 20],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Horses'},
		'dogs':		{'index': 19,	'outfit': 'animal',			'subgroup': [18, 19, 20],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Dogs'},
		'falcons':	{'index': 20,	'outfit': 'animal',			'subgroup': [18, 19, 20],	'group': [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],	'name': 'Falcons'},
		'novan':	{'index': 21,	'outfit': 'history',		'subgroup': [21, 22, 23],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Novan History'},
		'foraff':	{'index': 22,	'outfit': 'history',		'subgroup': [21, 22, 23],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Foreign Affairs'},
		'world':	{'index': 23,	'outfit': 'history',		'subgroup': [21, 22, 23],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'World History'},
		'internal':	{'index': 24,	'outfit': 'intrigue',		'subgroup': [24, 25, 26],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Internal Affairs'},
		'forint':	{'index': 25,	'outfit': 'intrigue',		'subgroup': [24, 25, 26],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Foreign Intelligence'},
		'cipher':	{'index': 26,	'outfit': 'intrigue',		'subgroup': [24, 25, 26],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Ciphering'},
		'herbs':	{'index': 27,	'outfit': 'medicine',		'subgroup': [27, 28, 29],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Herbs'},
		'battle':	{'index': 28,	'outfit': 'medicine',		'subgroup': [27, 28, 29],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Battlefield Medicine'},
		'poison':	{'index': 29,	'outfit': 'medicine',		'subgroup': [27, 28, 29],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Poison'},
		'account':	{'index': 30,	'outfit': 'economics',		'subgroup': [30, 31, 32],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Accounting'},
		'trade':	{'index': 31,	'outfit': 'economics',		'subgroup': [30, 31, 32],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Trade'},
		'product':	{'index': 32,	'outfit': 'economics',		'subgroup': [30, 31, 32],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Production'},
		'strategy':	{'index': 33,	'outfit': 'military',		'subgroup': [33, 34, 35],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Strategy'},
		'naval':	{'index': 34,	'outfit': 'military',		'subgroup': [33, 34, 35],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Naval Strategy'},
		'logs':		{'index': 35,	'outfit': 'military',		'subgroup': [33, 34, 35],	'group': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],	'name': 'Logistics'},
		'meditate':	{'index': 36,	'outfit': 'faith',			'subgroup': [36, 37, 38],	'group': [36, 37, 38, 39, 40, 41],	'name': 'Meditation'},
		'divinate':	{'index': 37,	'outfit': 'faith',			'subgroup': [36, 37, 38],	'group': [36, 37, 38, 39, 40, 41],	'name': 'Divination'},
		'lore':		{'index': 38,	'outfit': 'faith',			'subgroup': [36, 37, 38],	'group': [36, 37, 38, 39, 40, 41],	'name': 'Lore'},
		'sense':	{'index': 39,	'outfit': 'lumen',			'subgroup': [39, 40, 41],	'group': [36, 37, 38, 39, 40, 41],	'name': 'Sense Magic'},
		'resist':	{'index': 40,	'outfit': 'lumen',			'subgroup': [39, 40, 41],	'group': [36, 37, 38, 39, 40, 41],	'name': 'Resist Magic'},
		'wield':	{'index': 41,	'outfit': 'lumen',			'subgroup': [39, 40, 41],	'group': [36, 37, 38, 39, 40, 41],	'name': 'Wield Magic'}
	},
	'weekend': {
		'ball': { 'name': 'Attend Ball' },
		'barracks': { 'name': 'Tour Barracks' },
		'castle': {'name': 'Explore Castle' },
		'court': {'name': 'Attend Court'},
		'dungeons': { 'name': 'Visit Dungeons'},
		'gardens': { 'name': 'Walk in Gardens'},
		'hunt': { 'name': 'Hunting'},
		'service': { 'name': 'Attend Service'},
		'sneak': { 'name': 'Sneak Out'},
		'sports': { 'name': 'Sports'},
		'tomb': { 'name': 'Visit Tomb'},
		'toys': { 'name': 'Play with Toys'},
		'adair': { 'name': 'Talk to Adair'},
		'advisors': { 'name': 'Meet with Advisors'},
		'charlotte': { 'name': 'Talk to Charlotte'},
		'father': { 'name': 'Talk to Father'},
		'julianna': { 'name': 'Visit Julianna'},
		'sabine': { 'name': 'Talk to Sabine'},
		'selene': { 'name': 'Visit Selene'},
		'treasury': { 'name': 'Visit Treasury'}
	}
};

Object.freeze(maps);

/* Specific game logic */
const [findWeekActivity, findAvailableThisWeekend, findAvailableAllWeekends, readActivityOptionText, hasCustomActivity] = (function() {

	function generateLine(parent, text, endBreak = true) {
		parent.appendChild(document.createTextNode(text));
		if (endBreak) {
			parent.appendChild(document.createElement('br'));
		}
	};

	function generateSpecial(parent, text, className, endBreak = true) {
		const e = document.createElement('span');
		e.setAttribute('class', className);
		e.appendChild(document.createTextNode(text));
		parent.appendChild(e);
		if (endBreak) {
			parent.appendChild(document.createElement('br'));
		}
	};

	function generateOptions(parent, choices, week, order, texts, conditions, endBreak = true) {
		const id = 'week' + week + '-' + order;
		let f;
		const e = document.createElement('select');
		e.setAttribute('class', 'week' + week);
			e.setAttribute('id', id);
		e.setAttribute('onchange', 'rebuildContent(this.id)');
		const options = texts.map((x, n) => [(n + 1).toString(), x]).filter((x, n) => conditions[n]);
		options.unshift(['none', 'None Selected']);
		options.forEach(x => {
			f = document.createElement('option');
			f.setAttribute('value', x[0]);
			if (choices[id] === x[0]) {
				f.setAttribute('selected', '');
			}
			f.appendChild(document.createTextNode(x[1]));
			e.appendChild(f);
		});
		parent.appendChild(e);
		if (endBreak) {
			parent.appendChild(document.createElement('br'));
		}
	};

	const weekendActivities = {
		'ball': {
			'condition': s => readSkill(s, 'dance') >= 50,
			'preview': s => (readMoodAxis(s, 'P') > 0) ? 'DP' : (readMoodAxis(s, 'P') < 0) ? 'CP' : 'P',
			'generate': (s, n, c) => {
				s = offsetMisc(s, {'Na': 1});
				const p = readMoodAxis(s, 'P');
				s = (p > 0) ? offsetMood(s, 'PD') : (p < 0) ? offsetMood(s, 'PC') : offsetMood(s, 'P');
				return [s, emptyDocumentCallback(s, n, c)];
			}
		},
		'barracks': {
			'condition': s => false,
			'preview': s => {
				if (readFlag(s, 'War') && readAndNotFlags(s, ['Prestige', 'Victory'])) {
					return 'DP';
				}
				const w = readMoodAxis(s, 'W');
				return (w > 0) ? '-WP' : (w < 0) ? '-YP' : 'P';
				},
			'generate': emptyGeneration
		},
		'castle': {
			'condition': s => true,
			'preview': s => 'FL',
			'generate': (s, n, c) => [offsetMood(s, 'FL'), emptyDocumentCallback(s, n, c)]
		},
		'court': {
			'condition': s => true,
			'preview': s => (readFlag(s, 'Regicide')) ? '2Y2P' : 'D2YP' ,
			'generate': (s, n, c) => {
				s = offsetMisc(s, {'Na': 1, 'Ca': 1});
				return [offsetMood(s, 'D2YP'), emptyDocumentCallback(s, n, c)];
				}
		},
		'dungeons': {
			'condition': s => false,
			'preview': s => {
				if ([directionCache['dungeons3'], directionCache['dungeons7'], directionCache['dungeons18']].some(x => x(s) > 1)) {
					return '???';
				}
				const w = readMoodAxis(s, 'W');
				return (readMisc(s, 'K') >= 5) ? 'AC' : (w > 0) ? 'AW' : (w < 0) ? 'FY' : 'No Effect';
				},
			'generate': emptyGeneration
		},
		'gardens': {
			'condition': s => true,
			'preview': s => 'CL',
			'generate': (s, n, c) => [offsetMood(s, 'CL'), emptyDocumentCallback(s, n, c)]
		},
		'hunt': {
			'condition': s => readSkill(s, 'horses') >= 50,
			'preview': s => (readMoodAxis(s, 'A') > 0) ? '-2AC' : '-2FD',
			'generate': (s, n, c) => {
				if (readMoodAxis(s, 'A') > 0) {
					s = offsetMisc(s, {'K': 1});
					s = offsetMood(s, '-2AC');
				}
				else {
					s = offsetMisc(s, {'K': 0.5});
					s = offsetMood(s, '-2FD');
				}
				return [s, emptyDocumentCallback(s, n, c)];
			}
		},
		'service': {
			'condition': s => {
				const m1 = readMoodAxis(s, 'A');
				const m2 = readMoodAxis(s, 'C');
				return m1 !== 0 || m2 !== 0;
				},
			'preview': s => {
				const m1 = readMoodAxis(s, 'A');
				const m2 = readMoodAxis(s, 'C');
				const big = Math.abs(m1) >= Math.abs(m2);
				return (big && m1 > 0) ? '-A' : (big && m1 < 0) ? '-F' : (m2 > 0) ? '-C' : '-D';
				},
			'generate': (s, n, c) => {
				const m1 = readMoodAxis(s, 'A');
				const m2 = readMoodAxis(s, 'C');
				const big = Math.abs(m1) >= Math.abs(m2);
				s = (readSkill(s, 'sense') >= 80 && !readFlag(s, 'Priestess')) ? addFlag(s, 'Priestess') : s;
				return [(big && m1 > 0) ? offsetMood(s, '-A') : (big && m1 < 0) ? offsetMood(s, '-F') : (m2 > 0) ? offsetMood(s, '-C') : offsetMood(s, '-D'), emptyDocumentCallback(s, n, c)];
				}
		},
		'sneak': {
			'condition': s => true,
			'preview': s => (readFlag(s, 'Regicide')) ? 'DWL' : '2WL',
			'generate': (s, n, c) => [offsetMood(s, '2WL'), emptyDocumentCallback(s, n, c)]
		},
		'sports': {
			'condition': s => readSkill(s, 'reflexes') >= 30,
			'preview': s => (readMoodAxis(s, 'L') > 0) ? 'A-L' : 'A',
			'generate': (s, n, c) => [(readMoodAxis(s, 'L') > 0) ? offsetMood(s, 'A-L') : offsetMood(s, 'A'), emptyDocumentCallback(s, n, c)]
		},
		'tomb': {
			'condition': s => true,
			'preview': s => 'FD',
			'generate': (s, n, c) => [offsetMood(s, 'FD'), emptyDocumentCallback(s, n, c)]
		},
		'toys': {
			'condition': s => true,
			'preview': s => 'CYL',
			'generate': (s, n, c) => [offsetMood(s, 'CYL'), emptyDocumentCallback(s, n, c)]
		},
		'adair': {
			'condition': s => false,
			'preview': s => '???',
			'generate': emptyGeneration
		},
		'advisors': {
			'condition': s => false,
			'preview': s => '???',
			'generate': emptyGeneration
		},
		'charlotte': {
			'condition': s => false,
			'preview': s => '???',
			'generate': emptyGeneration
		},
		'father': {
			'condition': s => false,
			'preview': s => '???',
			'generate': emptyGeneration
		},
		'julianna': {
			'condition': s => false,
			'preview': s => '???',
			'generate': emptyGeneration
		},
		'sabine': {
			'condition': s => false,
			'preview': s => '???',
			'generate': emptyGeneration
		},
		'selene': {
			'condition': s => false,
			'preview': s => '???',
			'generate': emptyGeneration
		},
		'treasury': {
			'condition': s => false,
			'preview': s => (readAndNotFlags(s, ['Crystal', 'Consequences']) && readOrFlags(s, ['Mentor', 'Assistant']) && readOrFlags(s, ['Inheritance', 'Intransigence']) || (readSkill(s, 'account') < 60 && readSkill(s, 'presence') < 70)) ? '???' : 'W',
			'generate': emptyGeneration
		}
	};

	const directionCache = {
		'adair24': s => (readFlag(s, 'Ward') && !readFlag(s, 'Fiance')) ? 24 : 0,
		'adair31': s => (readAndFlags(s, ['Ward', 'Divided']) && readAndNotFlags(s, ['United', 'Engagements'])) ? 31 : 0,
		'adair37': s => (readAndFlags(s, ['Ward', 'Regicide']) && !readFlag(s, 'Diminutives')) ? 37 : 0,
		'barracks1': s => (readSkill(s, 'strategy') >= 40) ? 1 : 0,
		'barracks35': s => (readSkill(s, 'strategy') < 40) ? 0 : (readAndNotFlags(s, ['Prestige', 'Victory'])) ? 35 : 1,
		'charlotte38': s => (readFlag(s, 'Cousin') && !readFlag(s, 'Reunion')) ? 38 : 0,
		'father6': s => (readAndNotFlags(s, ['Crystal', 'Intransigence']) && readOrFlags(s, ['Inheritance', 'Assistant'])) ? 3 : (readAndNotFlags(s, ['Trust', 'Heartless', 'Assistant'])) ? 2 : 0,
		'father11': s => (readAndNotFlags(s, ['Crystal', 'Intransigence']) && readOrFlags(s, ['Inheritance', 'Assistant'])) ? 3 : (readAndNotFlags(s, ['Trust', 'Heartless', 'Assistant'])) ? 2 : (readOrFlags(s, ['Charade', 'Rebuffed']) && !readFlag(s, 'Retrospective')) ? 10 : 0,
		'father21': s => (readAndNotFlags(s, ['Crystal', 'Intransigence']) && readOrFlags(s, ['Inheritance', 'Assistant'])) ? 3 : (readAndNotFlags(s, ['Trust', 'Heartless', 'Assistant'])) ? 2 : (readFlag(s, 'Outlaw') && readOrFlags(s, ['Corruption', 'Demons']) && !readFlag(s, 'Artifact')) ? 21 : 0,
		'father37': s => (readFlag(s, 'Regicide')) ? 0 : (readFlag(s, 'Mirrored') && !readFlag(s, 'Sleepless')) ? 36 : (readAndNotFlags(s, ['Crystal', 'Intransigence']) && readOrFlags(s, ['Inheritance', 'Assistant'])) ? 3 : (readAndNotFlags(s, ['Trust', 'Heartless', 'Assistant'])) ? 2 : (readFlag(s, 'Outlaw') && readOrFlags(s, ['Corruption', 'Demons']) && !readFlag(s, 'Artifact')) ? 21 : 0,
		'julianna6':  s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : (readAndNotFlags(s, ['Intransigence', 'Crystal', 'Trust'])) ? 3 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Crystal', 'Imperative'])) ? 4 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 6 : 0,
		'julianna9':  s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : (readAndNotFlags(s, ['Intransigence', 'Crystal', 'Trust'])) ? 3 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Crystal', 'Imperative'])) ? 4 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 6 : ((readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) || (readFlag(s, 'Priestess') && !readFlag(s, 'Sensor'))) ? 9 : 0,
		'julianna16': s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : (readAndNotFlags(s, ['Intransigence', 'Crystal', 'Trust'])) ? 3 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Crystal', 'Imperative'])) ? 4 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 6 : ((readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) || (readFlag(s, 'Priestess') && !readFlag(s, 'Sensor'))) ? 9 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : 0,
		'julianna19': s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : (readAndNotFlags(s, ['Crystal', 'Ultimatum']) && readFlag(s, 'Vanguard')) ? 18 : (readAndNotFlags(s, ['Intransigence', 'Crystal', 'Trust'])) ? 3 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Crystal', 'Imperative'])) ? 4 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 6 : ((readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) || (readFlag(s, 'Priestess') && !readFlag(s, 'Sensor'))) ? 9 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (!readFlag(s, 'Lumen') && readFlag(s, 'Consequences')) ? 19 : 0,
		'julianna21': s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : (readAndNotFlags(s, ['Crystal', 'Ultimatum']) && readFlag(s, 'Vanguard')) ? 18 : (readAndNotFlags(s, ['Intransigence', 'Crystal', 'Trust'])) ? 3 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Crystal', 'Imperative'])) ? 4 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 6 : ((readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) || (readFlag(s, 'Priestess') && !readFlag(s, 'Sensor'))) ? 9 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (!readFlag(s, 'Lumen') && readFlag(s, 'Consequences')) ? 19 : (readOrFlags(s, ['Accusation', 'Instigation', 'Corruption', 'Tutelage']) && !readFlag(s, 'Prismatics')) ? 21 : 0,
		'julianna37': s => (!readFlag(s, 'Mentor')) ? 0 : (readFlag(s, 'Regicide') && !readFlag(s, 'Mentored')) ? 36 : (!readFlag(s, 'Inheritance')) ? 2 : (readAndNotFlags(s, ['Crystal', 'Ultimatum']) && readFlag(s, 'Vanguard')) ? 18 : (readAndNotFlags(s, ['Intransigence', 'Crystal', 'Trust'])) ? 3 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Crystal', 'Imperative'])) ? 4 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 6 : ((readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) || (readFlag(s, 'Priestess') && !readFlag(s, 'Sensor'))) ? 9 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (!readFlag(s, 'Lumen') && readFlag(s, 'Consequences')) ? 19 : (readOrFlags(s, ['Accusation', 'Instigation', 'Corruption', 'Tutelage']) && !readFlag(s, 'Prismatics')) ? 21 : 0,
		'selene9' : s => (!readFlag(s, 'Assistant')) ? 0 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 8 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Lumen', 'Imperative'])) ? 7 : (readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) ? 9 : 0,
		'selene16': s => (!readFlag(s, 'Assistant')) ? 0 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 8 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Lumen', 'Imperative'])) ? 7 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) ? 9 : 0,
		'selene21': s => (!readFlag(s, 'Assistant')) ? 0 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 8 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Lumen', 'Imperative'])) ? 7 : (readAndFlags(s, ['Intransigence', 'Imperative']) && readAndNotFlags(s, ['Crystal', 'Ultimatum'])) ? 18 : (!readFlag(s, 'Lumen') && readFlag(s, 'Consequences')) ? 19 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) ? 9 : (readOrFlags(s, ['Accusation', 'Instigation', 'Corruption', 'Tutelage']) && !readFlag(s, 'Prismatics')) ? 21 : 0,
		'selene37': s => (!readFlag(s, 'Assistant')) ? 0 : (readFlag(s, 'Regicide') && !readFlag(s, 'Mentored')) ? 36 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 8 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Lumen', 'Imperative'])) ? 7 : (readAndFlags(s, ['Intransigence', 'Imperative']) && readAndNotFlags(s, ['Crystal', 'Ultimatum'])) ? 18 : (!readFlag(s, 'Lumen') && readFlag(s, 'Consequences')) ? 19 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) ? 9 : (readOrFlags(s, ['Accusation', 'Instigation', 'Corruption', 'Tutelage']) && !readFlag(s, 'Prismatics')) ? 21 : 0,
		'dungeons3':  s => (readFlag(s, 'Dungeoness') && readAndNotFlags(s, ['Caution', 'Amnesty', 'Ambition'])) ? 2 : 1,
		'dungeons7':  s => (readFlag(s, 'Ambition') && readAndNotFlags(s, ['Brazenness', 'Jailbreak'])) ? 7 : 1,
		'dungeons18': s => (readFlag(s, 'Machination') && !readFlag(s, 'Madness')) ? 18 : 1,
		'treasury5': s => (readSkill(s, 'account') >= 60 || readFlag(s, 'Imperative')) ? 5 : 0,
		'true36': s => 36
	};

	const activityCache = {
		'adair25': {
			'direct': directionCache['adair24'],
			'generate': emptyGeneration
		},
		'adair32': {
			'direct': directionCache['adair31'],
			'generate': emptyGeneration
		},
		'adair38': {
			'direct': directionCache['adair37'],
			'generate': emptyGeneration
		},
		'barracks2': {
			'direct': directionCache['barracks1'],
			'generate': emptyGeneration
		},
		'barracks37': {
			'direct': directionCache['barracks35'],
			'generate': emptyGeneration
		},
		'court37': {
			'direct': directionCache['true36'],
			'generate': emptyGeneration
		},
		'dungeons3': {
			'direct': directionCache['dungeons3'],
			'generate': emptyGeneration
		},
		'dungeons8': {
			'direct': directionCache['dungeons7'],
			'generate': emptyGeneration
		},
		'dungeons19': {
			'direct': directionCache['dungeons18'],
			'generate': emptyGeneration
		},
		'treasury6': {
			'direct': directionCache['treasury5'],
			'generate': emptyGeneration
		},
		'father6': {
			'direct': directionCache['father6'],
			'generate': emptyGeneration
		},
		'father11': {
			'direct': directionCache['father11'],
			'generate': emptyGeneration
		},
		'father22': {
			'direct': directionCache['father21'],
			'generate': emptyGeneration
		},
		'father37': {
			'direct': directionCache['father37'],
			'generate': emptyGeneration
		},
		'julianna7': {
			'direct': directionCache['julianna6'],
			'generate': emptyGeneration
		},
		'julianna10': {
			'direct': directionCache['julianna9'],
			'generate': emptyGeneration
		},
		'julianna22': {
			'direct': directionCache['julianna21'],
			'generate': emptyGeneration
		},
		'julianna37': {
			'direct': directionCache['julianna37'],
			'generate': emptyGeneration
		},
		'selene10': {
			'direct': directionCache['selene9'],
			'generate': emptyGeneration
		},
		'selene22': {
			'direct': directionCache['selene21'],
			'generate': emptyGeneration
		},
		'selene37': {
			'direct': directionCache['selene37'],
			'generate': emptyGeneration
		},
		'sneak37': {
			'direct': directionCache['true36'],
			'generate': emptyGeneration
		}
	};

	const weekCallbacks = [
	// 0, Initial setup
	(s, c) => {
		s = offsetMood(s, '2F4D');
		s = offsetMisc(s, {'G': 10000, 'R': 12000});
		return [s, new DocumentFragment()];
	},
	// 1
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Family Visit: C');
		return [offsetMood(s, 'C'), page];
	},
	// 2
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, ['Julianna Arrives'])
		generateOptions(page, c, 2, 1, ['Send Away', 'Arrest', 'Let Stay'], [true, true, true]);
		if (c['week2-1'] === '1') {
			generateLine(page, ['AY']);
			s = offsetMood(s, 'AY');
		}
		else if (c['week2-1'] === '2') {
			generateLine(page, ['A, K']);
			s = offsetMood(s, 'A');
			s = offsetMisc(s, {'K': 1});
			s = addFlag(s, 'Dungeoness');
		}
		else if (c['week2-1'] === '3') {
			generateLine(page, ['W']);
			s = offsetMood(s, 'W');
			s = addFlag(s, 'Mentor');
		}
		return [s, page];
	},
	// 3
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, ['Hidden Danger'])
		if (readFlag(s, 'Mentor')) {
			s = addFlag(s, 'Protector');
			generateOptions(page, c, 3, 1, ['Stay Still', 'Look Down'], [true, true]);
			if (c.hasOwnProperty('week3-1') && c['week3-1'] === '1') {
				if (readSkill(s, 'composure') < 10) {
					c['week3-1'] = '2'
				}
			}
			if (c.hasOwnProperty('week3-1') && c['week3-1'] === '2') {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
			}
		}
		else if (readSkill(s, 'reflexes') >= 20){
			generateLine(page, 'A');
			s = offsetMood(s, 'A');
		}
		else {
			generateLine(page, 'F');
			s = offsetMood(s, 'F');
			s = addFlag(s, 'Kin');
		}
		return [s, page];
	},
	// 4
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'A Quiet Day');
		return [s, page];
	},
	// 5
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'An Unexpected Gift');
		if (readSkill(s, 'forint') < 10 && readSkill(s, 'foraff') < 40) {
			s = offsetMisc(s, {'Ca': -3});
		}
		if (readSkill(s, 'court') >= 10) {
			generateOptions(page, c, 5, 1, ['Wear', 'Wait'], [true, true]);
			if (!c.hasOwnProperty('week5-1')) {}
			else if (c['week5-1'] === '1') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Finery');
			}
			else if (c['week5-1'] === '2') {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
			}
		}
		else {
			generateLine(page, 'C');
			s = offsetMood(s, 'C');
			s = addFlag(s, 'Finery');
		}
		return [s, page];
	},
	// 6
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'A New Face');
		if (!readFlag(s, 'Mentor') && !readFlag(s, 'Dungeoness')) {
			generateOptions(page, c, 6, 1, ['Decline', 'Agree'], [true, true]);
			if (!c.hasOwnProperty('week6-1')) {}
			else if (c['week6-1'] === '1') {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
				s = addFlag(s, 'Mentorless');
			}
			else if (c['week6-1'] === '2') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Assistant');
			}
		}
		else if (!readFlag(s, 'Mentor') && readFlag(s, 'Dungeoness')) {
			generateOptions(page, c, 6, 2, ['Agree', 'Decline'], [true, true]);
			if (!c.hasOwnProperty('week6-2')) {}
			else if (c['week6-2'] === '1') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = offsetMisc(s, {'Na': -5});
				s = addFlag(s, 'Mentor');
			}
			else if (c['week6-2'] === '2') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
		}
		else if (!readFlag(s, 'Inheritance')) {
		}
		else {
			generateOptions(page, c, 6, 3, ['Climb', 'Guards', 'Run'], [true, true, true]);
			if (!c.hasOwnProperty('week6-3')) {}
			else if (c['week6-3'] === '1' && readSkill(s, 'climbing') >= 20) {
				s = addFlag(s, 'Thief');
			}
			else if (c['week6-3'] === '2') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
			else if (c['week6-3'] === '3') {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
			}
		}
		return [s, page];
	},
	// 7
	(s, c) => {
		const page = new DocumentFragment();
		if (readSkill(s, 'elegance') < 10 && readSkill(s, 'reflexes') < 10) {
			generateLine(page, 'Bumblement');
			generateOptions(page, c, 7, 1, ['Accept', 'Apologize', 'Punish'], [readSkill(s, 'court') >= 20, true, true]);
			if (!c.hasOwnProperty('week7-1')) {}
			else if (c['week7-1'] === '1') {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
				s = offsetMisc(s, {'Ca': 5});
			}
			else if (c['week7-1'] === '2') {
				generateLine(page, 'D');
				s = offsetMood(s, 'D');
				s = offsetMisc(s, {'Na': -5});
			}
			else if (c['week7-1'] === '3') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'K': 1, 'Ca': -5});
			}
		}
		if (readFlag(s, 'Dungeoness') && !readFlag(s, 'Mentor')) {
			generateLine(page, 'Lack of Leadership');
			generateOptions(page, c, 7, 2, ['Release', 'Title'], [true, true]);
			if (!c.hasOwnProperty('week7-2')) {}
			else if (c['week7-2'] === '1') {
				generateLine(page, 'P');
				s = offsetMood(s, 'P');
				s = addFlag(s, 'Amnesty');
			}
			else if (c['week7-2'] === '2') {
				generateLine(page, 'CW');
				s = offsetMood(s, 'CW');
				s = addFlag(s, 'Ambition');
			}
		}
		return [s, page];
	},
	// 8
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Moveable Type');
		if (readSkill(s, 'product') + readSkill(s, 'trade') >= 50) {
			generateOptions(page, c, 8, 1, ['Accept', 'Decline'], [true, true]);
			if (c.hasOwnProperty('week8-1') && c['week8-1'] === '1') {
				generateLine(page, '-875G');
				s = offsetMisc(s, {'G': -875});
				s = addFlag(s, 'Printing');
			}
		}
		return [s, page];
	},
	// 9
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Occupation');
		if (readSubgroup(s, 'military') > 0) {
			generateOptions(page, c, 9, 1, ['Negotiate', 'Send Troops'], [true, true]);
		}
		if (!c.hasOwnProperty('week9-1') || c['week9-1'] === '1') {
			generateLine(page, 'Y');
			s = offsetMood(s, 'Y');
			s = addFlag(s, 'Negotiations');
		}
		else if (c['week9-1'] === '2') {
			const f = readFlag(s, 'Lumen');
			generateLine(page, (f) ? 'W ' : 'W', !f);
			s = offsetMood(s, 'W');
			s = addFlag(s, 'Rebuffed');
			if (f) {
				generateOptions(page, c, 9, 2, ['Use Magic', 'Do Not'], [true, true]);
				if (!c.hasOwnProperty('week9-2')) {}
				else if (c['week9-2'] ===  '1') {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
					s = addFlag(s, 'Sorceress');
				}
			}
		}
		if (readFlag(s, 'Finery')) {
			generateLine(page, 'A Matter of Etiquette');
			if (readSkill(s, 'court') < 10) {
				s = offsetMisc(s, {'Na': -5});
			}
			else {
				generateOptions(page, c, 9, 3, ['Considering', 'Not'], [true, true]);
				if (!c.hasOwnProperty('week9-3')) {}
				else if (c['week9-3'] ===  '1') {
					generateLine(page, 'C');
					s = offsetMood(s, 'C');
					s = offsetMisc(s, {'Na': 5});
				}
				else if (c['week9-3'] ===  '2') {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					s = offsetMisc(s, {'Na': -3});
				}
			}
		}
		return [s, page];
	},
	// 10
	(s, c) => {
		const page = new DocumentFragment();
		let losses;
		if (readFlag(s, 'Negotiations')) {
			generateLine(page, 'Negotiations');
			generateOptions(page, c, 10, 1, ['Surrender', 'Ransom', 'Punish', 'Bluff', 'Execute'], [true, true, readSkill(s, 'foraff') >= 20, true, true]);
			if (!c.hasOwnProperty('week10-1')){
			}
			else if (c['week10-1'] === '1') {
				generateLine(page, '2DY');
				s = offsetMood(s, '2DY');
				s = offsetMisc(s, {'Na': -30, 'Ca': -30});
				s = addFlag(s, 'Molehill');
			}
			else if (c['week10-1'] === '2') {
				generateOptions(page, c, 10, 2, ['Agree', 'Barter'], [true, readSkill(s, 'logs') >= 50 || readSkill(s, 'account') + readSkill(s, 'trade') > 50]);
				if (!c.hasOwnProperty('week10-2')) {
				}
				else if (c['week10-2'] === '1') {
					generateLine(page, 'P');
					s = offsetMood(s, 'P');
					s = offsetMisc(s, {'Na': -10, 'G': -8000});
					s = addFlag(s, 'Pittance');
				}
				else if (c['week10-2'] === '2') {
					s = addFlag(s, 'Pittance');
					if (readSkill(s, 'account') + readSkill(s, 'trade') > 50) {
						generateLine(page, 'W');
						s = offsetMood(s, 'W');
						s = offsetMisc(s, {'G': -4000});
					}
					else {
						generateLine(page, 'WP');
						s = offsetMood(s, 'WP');
						s = offsetMisc(s, {'G': -5000});
					}
				}
			}
			else if (c['week10-1'] === '3') {
				generateOptions(page, c, 10, 3, ['Title', 'Marriage', 'Execute'], [true, true, true]);
				if (!c.hasOwnProperty('week10-3')) {
				}
				else if (c['week10-3'] === '1') {
					generateLine(page, 'P');
					s = offsetMood(s, 'P');
					s = offsetMisc(s, {'Na': -15});
					s = addFlag(s, 'Denoble');
				}
				else if (c['week10-3'] === '2') {
					generateSpecial(page, 'You Do If I Say You Do', 'unlock')
					s = addFlag(s, 'Arrangement');
					if (readSkill(s, 'internal') < 40) {
						s = offsetMisc(s, {'Na': -10});
					}
				}
				else if (c['week10-3'] === '3') {
					generateLine(page, 'A', false);
					generateSpecial(page, 'Off with Their Heads', 'unlock')
					s = offsetMood(s, 'A');
					s = offsetMisc(s, {'K': 3, 'Na': -15});
					s = addFlag(s, 'Troublemaker');
				}
			}
			else if (c['week10-1'] === '4') {
				s = addFlag(s, 'Pokerface');
				generateOptions(page, c, 10, 4, ['Threaten', 'Overwhelm', 'Friends', 'Magic'], [true, readSkill(s, 'foraff') >= 80 || readSkill(s, 'forint') >= 80, readSkill(s, 'court') >= 10 && readFlag(s, 'Finery'), readFlag(s, 'Lumen')]);
				if (!c.hasOwnProperty('week10-4')) {
				}
				else if (c['week10-4'] === '1') {
					if (readSkill(s, 'presence') >= 60) {
						generateLine(page, 'C');
						s = offsetMood(s, 'C');
						s = offsetMisc(s, {'Na': 10});
					}
					else {
						generateLine(page, 'D');
						s = offsetMood(s, 'D');
						s = addFlag(s, 'Charade');
					}
				}
				else if (c['week10-4'] === '2') {
					generateLine(page, 'C');
					s = offsetMood(s, 'C');
					s = offsetMisc(s, {'Na': 10});
				}
				else if (c['week10-4'] === '3') {
					generateLine(page, 'C');
					s = offsetMood(s, 'C');
					s = offsetMisc(s, {'Na': 10});
					s = addFlag(s, 'Spartacus');
				}
				else if (c['week10-4'] === '4') {
					if (readSkill(s, 'wield') + readSkill(s, 'presence') > 60) {
						s = offsetMisc(s, {'Na': 10});
						s = addFlag(s, 'Showoff');
					}
					else {
						generateLine(page, 'D');
						s = offsetMood(s, 'D');
						s = addFlag(s, 'Charade');
					}				}
			}
			else if (c['week10-1'] === '5') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'K': 5});
				s = addFlag(s, 'Charade');
			}
		}
		else if (readFlag(s, 'Sorceress')) {
			generateLine(page, 'A Great Force');
			const w = readSkill(s, 'wield');
			if (w >= 40){
				generateLine(page, 'AC2W');
				s = offsetMood(s, 'AC2W');
				s = offsetMisc(s, {'Na': 20});
				s = addFlag(s, 'Arcanist');
			}
			else if (w >= 30) {
				generateLine(page, 'AC');
				s = offsetMood(s, 'AC');
				losses = Math.floor(637 - 2 * readSkill(s, 'strategy'));
				s = offsetMisc(s, {'R': -1 * losses});
			}
			else {
				generateLine(page, '2A');
				s = offsetMood(s, '2A');
				losses = Math.floor(1750 - readSkill(s, 'logs') - 2 * readSkill(s, 'strategy'));
				s = offsetMisc(s, {'R': -1 * losses, 'Na': -5});
			}
		}
		else {
			generateLine(page, 'Duty');
			generateLine(page, 'A');
			s = offsetMood(s, 'A');
			losses = Math.floor(1200 * (0.86 - 0.0036 * (readSkill(s, 'strategy') + 0.2 * readSkill(s, 'logs'))));
			s = offsetMisc(s, {'R': -1 * losses});
		}
		return [s, page];
	},
	// 11
	(s, c) => {
		const page = new DocumentFragment();
		let losses;
		generateLine(page, 'Unfortunates');
		if (readFlag(s, 'Charade')) {
			generateLine(page, 'A');
			s = offsetMood(s, 'A');
			losses = Math.floor(1200 * (0.86 - 0.0036 * (readSkill(s, 'strategy') + 0.2 * readSkill(s, 'logs'))));
			s = offsetMisc(s, {'R': -1 * losses});
		}
		else {
			generateLine(page, 'D');
			s = offsetMood(s, 'D');
			s = addFlag(s, 'Beast');
		}
		return [s, page];
	},
	// 12
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'An Unexpected Guest');
		if (readFlag(s, 'Finery')) {
			generateOptions(page, c, 12, 1, ['Accept', 'Decline'], [true, true]);
			if (!c.hasOwnProperty('week12-1')) {
			}
			else if (c['week12-1'] === '1') {
				generateLine(page, 'CW');
				s = offsetMood(s, 'CW');
				s = addFlag(s, 'Opportunist');
			}
			else if (c['week12-1'] === '2') {
				if (readFlag(s, 'Spartacus')) {
					if (determineMood(s) === 'Y') {
						generateLine(page, 'Y');
						s = offsetMood(s, 'Y');
						s = addFlag(s, 'Opportunist');
						if (readSkill(s, 'court') < 40) {
							s = addFlag(s, 'Disillusioned');
						}
					}
					else {
						generateOptions(page, c, 12, 2, ['Accept', 'Decline'], [true, true]);
						if (!c.hasOwnProperty('week12-2')) {
						}
						else if (c['week12-2'] === '1') {
							generateLine(page, 'Y');
							s = offsetMood(s, 'Y');
							s = addFlag(s, 'Opportunist');
							if (readSkill(s, 'court') < 40) {
								s = addFlag(s, 'Disillusioned');
							}
						}
						else if (c['week12-2'] === '2') {
							s = addFlag(s, 'Spurned');
							if (readSkill(s, 'court') < 40) {
								generateLine(page, 'W');
								s = offsetMood(s, 'W');
								s = offsetMisc(s, {'Na': -10});
							}
							else {
								generateLine(page, 'P');
								s = offsetMood(s, 'P');
								s = offsetMisc(s, {'Na': -15});
							}
						}
					}
				}
				else if (readSkill(s, 'court') < 40) {
					s = offsetMisc(s, {'Na': -10});
					s = addFlag(s, 'Spurned');
				}
			}
		}
		else if (readSkill(s, 'herbs') + readSkill(s, 'battle') >= 50) {
			generateOptions(page, c, 12, 3, ['Agree', 'Decline'], [true, true]);
			if (!c.hasOwnProperty('week12-3')) {
			}
			else if (c['week12-3'] === '1') {
				generateLine(page, '-1200G');
				s = offsetMisc(s, {'Ca': 20, 'G': -1200});
				s = addFlag(s, 'Hospital');
			}
		}
		return [s, page];
	},
	// 13
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Judgement');
		const ia = readSkill(s, 'internal');
		generateOptions(page, c, 13, 1, ['Labor', 'Prison', 'Execute', 'Question', 'Talk'], [true, true, true, ia < 100 && ia >= 30, ia >= 100]);
		if (!c.hasOwnProperty('week13-1')) {
		}
		else if (c['week13-1'] === '1') {
			generateLine(page, 'D');
			s = offsetMood(s, 'D');
			s = offsetMisc(s, {'Ca': 10, 'Na': -5});
			s = addFlag(s, 'Unapproved');
		}
		else if (c['week13-1'] === '2') {
			generateLine(page, 'A');
			s = offsetMood(s, 'A');
			if (readSkill(s, 'archery') < 60) {
				s = offsetMisc(s, {'Ca': -5});
			}
		}
		else if (c['week13-1'] === '3') {
			generateLine(page, 'A');
			s = offsetMood(s, 'A');
			if (readSkill(s, 'archery') >= 60) {
				s = offsetMisc(s, {'Ca': -10, 'Na': 10});
			}
			else {
				s = offsetMisc(s, {'K': 1, 'Ca': -10, 'Na': 10});
			}
		}
		else if (c['week13-1'] === '4') {
			if (readSkill(s, 'court') >= 60) {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else {
				generateLine(page, '2A');
				s = offsetMood(s, '2A');
				s = offsetMisc(s, {'Ca': -10, 'Na': -10});
				s = addFlag(s, 'Unapproved');
			}
		}
		else if (c['week13-1'] === '5') {
			generateLine(page, 'C');
			s = offsetMood(s, 'C');
		}
		return [s, page];
	},
	// 14
	(s, c) => {
		const page = new DocumentFragment();
		if (readSkill(s, 'divinate') >= 60) {
			s = addFlag(s, 'Augury');
		}
		const cm = readSkill(s, 'court') >= 10;
		if (readFlag(s, 'Thief') && cm) {
			generateLine(page, 'Thievery');
			generateOptions(page, c, 14, 1, ['Guards', 'Challenge', 'Eject', 'Ignore'], [true, cm < 50, cm >= 50, cm < 50]);
			if (!c.hasOwnProperty('week14-1')) {
			}
			else if (c['week14-1'] === '1') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'Ca': -5});
			}
			else if (c['week14-1'] === '2') {
				generateOptions(page, c, 14, 2, ['Guards', 'Eject'], [true, true]);
				if (!c.hasOwnProperty('week14-2')) {
				}
				else if (c['week14-2'] === '1') {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
					s = offsetMisc(s, {'Ca': -5});
				}
				else if (c['week14-2'] === '2') {
					s = offsetMisc(s, {'Ca': 5});
					s = addFlag(s, 'Roguish');
				}
			}
			else if (c['week14-1'] === '3') {
					s = offsetMisc(s, {'Ca': 5});
					s = addFlag(s, 'Roguish');
			}
			else if (c['week14-1'] === '4') {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
			}
		}
		if (!readFlag(s, 'Beast')) {
			generateLine(page, 'Inevitability: D');
			s = offsetMood(s, 'D');
			s = addFlag(s, 'Beast');
		}
		else if (!readFlag(s, 'Hospital') && readSkill(s, 'herbs') + readSkill(s, 'battle') >= 50) {
			generateLine(page, 'A Medical Frontier');
			generateOptions(page, c, 14, 3, ['Agree', 'Decline'], [true, true]);
			if (!c.hasOwnProperty('week14-3')) {
			}
			else if (c['week14-3'] === '1') {
				generateLine(page, '-1200G');
				s = offsetMisc(s, {'Ca': 20, 'G': -1200});
				s = addFlag(s, 'Hospital');
			}
		}
		return [s, page];
	},
	// 15
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Prepare for the Procession');
		if (readFlag(s, 'Opportunist')) {
			generateOptions(page, c, 15, 1, ['Invite', 'Do Not'], [true, true]);
			if (!c.hasOwnProperty('week15-1')) {
			}
			else if (c['week15-1'] === '1') {
				s = addFlag(s, 'Suitor');
			}
			else if (c['week15-1'] === '2' && !readFlag(s, 'Disillusioned')) {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
			}
		}
		if (readFlag(s, 'Printing')) {
			generateOptions(page, c, 15, 2, ['Poems', 'Army', 'Lumen', 'Religion'], [true, readSkill(s, 'strategy') > 30, true, true]);
			if (!c.hasOwnProperty('week15-2')) {
			}
			else if (c['week15-2'] === '1') {
				generateLine(page, 'D');
				s = offsetMood(s, 'D');
				s = offsetMisc(s, {'Ca': -10, 'Na': 10});
			}
			else if (c['week15-2'] === '2') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = offsetMisc(s, {'R': 500});
			}
			else if (c['week15-2'] === '3' && readSkill(s, 'lore') < 80) {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Propaganda');
			}
			else if (c['week15-2'] === '4') {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
			}
		}
		return [s, page];
	},
	// 16
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'The Good Lady');
		generateOptions(page, c, 16, 1, ['Lead', 'Speech', 'Avoid'], [true, true, true]);
		if (!c.hasOwnProperty('week16-1')) {
		}
		else if (c['week16-1'] === '1' || c['week16-1'] === '2') {
			generateLine(page, 'CWP');
			s = offsetMood(s, 'CWP');
			const de = readSkill(s, 'decorate');
			if (readSkill(s, 'elegance') >= 70 || de >= 70) {
				s = offsetMisc(s, {'Ca': 10});
			}
			else if (de >= 50) {
				s = offsetMisc(s, {'Ca': 5});
			}
			if (c['week16-1'] === '2') {
				if (readSkill(s, 'public') >= 50) {
					s = offsetMisc(s, {'Ca': 10, 'Na': 10});
					if (readSkill(s, 'voice') >= 70) {
						s = offsetMisc(s, {'Ca': 5});
					}
				}
				else {
					s = offsetMisc(s, {'Na': -10});
				}
			}
			if (readFlag(s, 'Showoff') || readFlag(s, 'Troublemaker') || readFlag(s, 'Sorceress') || readFlag(s, 'Penpal')) {
				s = addFlag(s, 'Assassin');
				const ref = readSkill(s, 'reflexes');
				const flex = readSkill(s, 'flexible');
				const wield = readSkill(s, 'wield');
				if (ref < 30 && flex < 30) {
					generateSpecial(page, 'Gotten too Close to a Sword', 'death');
				}
				generateOptions(page, c, 16, 2, ['Fight', 'Blast', 'Run'], [true, wield > 0, true]);
				if (!c.hasOwnProperty('week16-2')) {
				}
				else if (c['week16-2'] === '1'){
					const pole = readSkill(s, 'polearms');
					if (pole < 30 || (pole < 80 && ref < 80 && flex < 50)) {
						generateSpecial(page, 'Gotten too Close to a Sword', 'death');
					}
					else if(pole < 50) {
						generateLine(page, '10F');
						s = offsetMood(s, '10F');
					}
					else {
						generateOptions(page, c, 16, 3, ['Kill', 'Capture'], [true, true]);
						if (!c.hasOwnProperty('week16-3')) {
						}
						else if (c['week16-3'] === '1') {
							s = offsetMisc(s, {'K': 1, 'Na': 10});
						}
						else if (c['week16-3'] === '2') {
							s = offsetMisc(s, {'Na': 10});
						}
						generateLine(page, '5A');
						s = offsetMood(s, '5A');
					}
				}
				else if (c['week16-2'] === '2'){
					if (wield < 100 && ref < 80 && flex < 50 && readSkill(s, 'battle') < 20) {
						generateSpecial(page, 'Let Your Blood Run Dry', 'death');
					}
					else if (wield < 60) {
						generateSpecial(page, 'Gotten too Close to a Sword', 'death');
					}
				}
				else if (c['week16-2'] === '3'){
					if (ref < 80 && flex < 50 && readSkill(s, 'battle') < 20) {
						generateSpecial(page, 'Let Your Blood Run Dry', 'death');
					}
					else if (readSkill(s, 'running') >= 40) {
						generateLine(page, '3F');
						s = offsetMood(s, '3F');
					}
					else if (readMisc(s, 'Ca') < 25) {
						generateSpecial(page, 'Gotten too Close to a Sword', 'death');
					}
					else {
						generateLine(page, '5D3F');
						s = offsetMood(s, '5D3F');
					}
				}
			}
			if (!readFlag(s, 'Lumen') && (readFlag(s, 'Dungeoness') && !readFlag(s, 'Mentor') || readFlag(s, 'Mentorless') || readFlag(s, 'Mundanity') || (readFlag(s, 'Mentor') && readFlag(s, 'Imperative') && !readFlag(s, 'Vanguard')))) {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
				s = offsetMisc(s, {'Ca': -10});
				s = addFlag(s, 'Portent');
				if (readFlag(s, 'Crystal')) {
					s = addFlag(s, 'Portent');
				}
			}
		}
		else if (c['week16-1'] === '3') {
			generateLine(page, 'YL');
			s = offsetMood(s, 'YL');
			generateOptions(page, c, 16, 4, ['Fear', 'Yell', 'Excuse'], [true, true, readSubgroup(s, 'faith') >= 30]);
			if (!c.hasOwnProperty('week16-4')) {
			}
			else if (c['week16-4'] === '1') {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
				s = offsetMisc(s, {'Ca': -5, 'Na': -5});
			}
			else if (c['week16-4'] === '2') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'K': 1, 'Ca': -5});
			}
			else if (c['week16-4'] === '3') {
			}
		}
		if (readFlag(s, 'Dungeoness') && !readFlag(s, 'Mentor') && !readFlag(s, 'Amnesty')) {
			generateLine(page, 'Unredeemable');
			generateLine(page, 'F');
			s = offsetMood(s, 'F');
			s = addFlag(s, 'Jailbreak');
		}
		return [s, page];
	},
	// 17
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Grand Ball');
		if (readFlag(s, 'Assassin')) {
			const ciph = readSkill(s, 'cipher');
			if (ciph >= 60 && !readFlag(s, 'Troublemaker')) {
				s = addFlag(s, 'Stateful');
			}
			else if (ciph < 60) {
				s = addFlag(s, 'Stateless');
			}
		}
		if (readSkill(s, 'presence') < 50 && readSkill(s, 'elegance') < 50 && readSkill(s, 'composure') < 50 && readSkill(s, 'decorate') < 70) {
			generateLine(page, 'FP');
			s = offsetMood(s, 'FP');
			s = offsetMisc(s, {'Na': -10});
		}
		generateLine(page, 'First Dance');
		const su = readFlag(s, 'Suitor');
		const op = readFlag(s, 'Opportunist');
		if (su) {
			s = offsetMisc(s, {'Na': -5});
			generateOptions(page, c, 17, 1, ['Nod', 'Shake', 'Anger'], [true, true, true]);
			if (!c.hasOwnProperty('week17-1')) {
			}
			else if (c['week17-1'] === '1') {
				s = addFlag(s, 'Footwork');
			}
			else if (c['week17-1'] === '3') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'K': 0.5});
				s = addFlag(s, 'Footwork');
			}
		}
		else if (op) {
			generateOptions(page, c, 17, 2, ['Dance', 'Do Not'], [true, true]);
			if (!c.hasOwnProperty('week17-2')) {
			}
			else if (c['week17-2'] === '1') {
				s = addFlag(s, 'Preference');
				s = addFlag(s, 'Footwork');
			}
			else if (c['week17-2'] === '2') {
				s = offsetMisc(s, {'Na': -5});
			}
		}
		const intr = readSubgroup(s, 'intrigue');
		const cm = readSkill(s, 'court');
		if (!su && !op && intr >= 40 && cm >= 40) {
			s = addFlag(s, 'Footwork');
			generateOptions(page, c, 17, 3, ['Linley', 'Adair', 'Banion', 'Chaine', 'Armand', 'Erwin', 'Women'], [true, true, true, true, true, true, true]);
			if (!c.hasOwnProperty('week17-3')) {
			}
			else if (c['week17-3'] === '1') {
				s = addFlag(s, 'Exuberance');
			}
			else if (c['week17-3'] === '2') {
				s = addFlag(s, 'Naivete');
			}
			else if (c['week17-3'] === '7') {
				generateLine(page, 'WP');
				s = offsetMood(s, 'WP');
				generateOptions(page, c, 17, 4, ['Julianna', 'Brin', 'Arisse', 'Alice'], [readFlag(s, 'Mentor'), !readFlag(s, 'Denoble') && !readFlag(s, 'Troublemaker'), true, true]);
				if (!c.hasOwnProperty('week17-4')) {
				}
				else if (c['week17-4'] === '2') {
					s = addFlag(s, 'Sappho');
				}
				else if (c['week17-4'] === '4') {
					s = offsetMisc(s, {'K': 1, 'Ca': -5, 'Na': -15});
					s = addFlag(s, 'Hysteria');
				}
			}
		}
		else if (!su && (!op || readFlag(s, 'Preference'))) {
			s = addFlag(s, 'Footwork');
			generateOptions(page, c, 17, 5, ['Your Age', 'Younger', 'Older', 'Married', 'Scandalous'], [true, true, true, true, true]);
			if (!c.hasOwnProperty('week17-5')) {
			}
			else if (c['week17-5'] === '1') {
				s = addFlag(s, 'Exuberance');
			}
			else if (c['week17-5'] === '2') {
				s = addFlag(s, 'Naivete');
			}
			else if (c['week17-5'] === '5') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				if (!readFlag(s, 'Mentor') && !readFlag(s, 'Denoble') && !readFlag(s, 'Troublemaker')) {
					s = addFlag(s, 'Sappho');
				}
			}
		}
		const da = readSkill(s, 'dance');
		const foot = readFlag(s, 'Footwork');
		if (foot && da >= 90) {
			if (readFlag(s, 'Naivete') || readFlag(s, 'Hysteria')) {
				s = offsetMisc(s, {'Na': -5});
			}
			else {
				s = offsetMisc(s, {'Na': 5});
			}
		}
		else if (foot && readFlag(s, 'Hysteria') && da >= 30) {
				s = offsetMisc(s, {'K': 1, 'Ca': -5});
		}
		else if (foot && da < 50) {
			s = offsetMisc(s, {'Na': -10});
		}
		generateLine(page, 'Mingling');
		if (readSkill(s, 'court') + readSkill(s, 'flattery') > 50) {
			s = offsetMisc(s, {'Na': 10});
		}
		if (readFlag(s, 'Augury')) {
			generateOptions(page, c, 17, 6, ['Talk', 'Silent'], [true, true]);
			if (!c.hasOwnProperty('week17-6')) {
			}
			else if (c['week17-6'] === '1') {
				generateSpecial(page, 'A Timely Word', 'unlock');
				if (!readFlag(s, 'Naivete') || op) {
					s = addFlag(s, 'Naunt');
				}
			}
		}
		if (!readFlag(s, 'Charade') && !readFlag(s, 'Pittance') && !readFlag(s, 'Pokerface') && (readFlag(s, 'Negotiations') || readFlag(s, 'Arcanist'))) {
			generateLine(page, 'A Challenger');
			const [mole, trob, den] = [readFlag(s, 'Molehill'), readFlag(s, 'Troublemaker'), readFlag(s, 'Denoble')];
			if (readFlag(s, 'Arrangement')) {
				generateOptions(page, c, 17, 7, ['Accept', 'Refuse', 'Betrothed'], [true, true, op]);
				if (!c.hasOwnProperty('week17-7')) {
				}
				else if (c['week17-7'] === '1') {
					s = addFlag(s, 'Twostepper');
					if (su) {
						s = offsetMisc(s, {'Na': -5});
					}
					else if (cm >= 40) {
						generateOptions(page, c, 17, 8, ['Use', 'Marry'], [true, true]);
						if (!c.hasOwnProperty('week17-8')) {
						}
						else if (c['week17-8'] === '1') {
							generateLine(page, 'W');
							s = offsetMood(s, 'W');
							s = offsetMisc(s, {'K': 1});
							s = addFlag(s, 'Plaything')
						}
						else if (c['week17-8'] === '2') {
							s = addFlag(s, 'Playful')
							if (op) {
								generateLine(page, 'W', false);
								s = offsetMood(s, 'W');
								generateSpecial(page, 'A Promise Discarded', 'unlock');
							}
						}
					}
					else if (op) {
						generateOptions(page, c, 17, 9, ['Talarist', 'Banion'], [true, true]);
						if (!c.hasOwnProperty('week17-9')) {
						}
						else if (c['week17-9'] === '1') {
							generateLine(page, 'A');
							s = offsetMood(s, 'A');
							s = offsetMisc(s, {'Na': -10});
							s = addFlag(s, 'Plaything')
						}
						else if (c['week17-9'] === '2') {
							generateLine(page, 'Y', false);
							s = offsetMood(s, 'Y');
							generateSpecial(page, 'A Promise Discrded', 'unlock');
						}
					}
					else {
						generateLine(page, 'YP');
						s = offsetMood(s, 'YP');
					}
				}
				else if (c['week17-7'] === '2') {
					generateLine(page, 'P');
					s = offsetMood(s, 'P');
					if (!op && readSubgroup(s, 'conversation') >= 50) {
						s = offsetMisc(s, {'Na': 5});
					}
				}
				else if (c['week17-7'] === '3' && readSubgroup(s, 'conversation') >= 50) {
					s = offsetMisc(s, {'Na': 5});
				}
			}
			else if (mole || trob || den) {
				generateOptions(page, c, 17, 10, ['Duel', 'Ignore', 'Accuse', 'Execute'], [true, readSkill(s, 'composure') >= 20, readFlag(s, 'Assassin'), true]);
				if (!c.hasOwnProperty('week17-10')) {
				}
				else if (c['week17-10'] === '1') {
					if (su) {
						const ia = readSkill(s, 'internal');
						const fi = readSkill(s, 'forint');
						if (ia < 70 && fi < 70 && readSkill(s, 'foraff') < 40) {
							s = offsetMisc(s, {'Na': -15});
						}
						else {
							generateOptions(page, c, 17, 11, ['Speak', 'Silent'], [true, true]);
							if (!c.hasOwnProperty('week17-11')) {
							}
							else if (c['week17-11'] === '1') {
								generateLine(page, 'Y');
								s = offsetMood(s, 'Y');
								if (readSkill(s, 'flattery') < 60) {
									s = offsetMisc(s, {'Na': -10});
								}
							}
							else if (c['week17-11'] === '2') {
								s = offsetMisc(s, {'Na': -15});
							}
						}
					}
					else {
						generateLine(page, 'AW', false);
						s = offsetMood(s, 'AW');
						generateSpecial(page, 'A Matter of Honor', 'unlock', false);
						if (readSubgroup(s, 'athletics') < 40|| readSkill(s, 'swords') < 70) {
							generateSpecial(page, 'Gotten too Close to a Sword', 'death');
						}
						else {
							generateLine(page, '');
							s = addFlag(s, 'Gracefulness');
							s = addFlag(s, 'Eventful');
						}
					}
				}
				else if (c['week17-10'] === '2') {
					generateLine(page, 'Y');
					s = offsetMood(s, 'Y');
					s = offsetMisc(s, {'Na': -10});
				}
				else if (c['week17-10'] === '3') {
					s = addFlag(s, 'Gracefulness');
					s = addFlag(s, 'Eventful');
					generateOptions(page, c, 17, 12, ['Imprison', 'Execute'], [true, true]);
					if (!c.hasOwnProperty('week17-12')) {
					}
					else if (c['week17-12'] === '1') {
						generateLine(page, 'A');
						s = offsetMood(s, 'A');
					}
					else if (c['week17-12'] === '2') {
						generateLine(page, 'A', false);
						generateSpecial(page, 'Off with Their Heads', 'unlock');
						s = offsetMood(s, 'A');
						s = offsetMisc(s, {'K': 3});
					}
				}
				else if (c['week17-10'] === '4') {
					generateLine(page, 'A', false);
					generateSpecial(page, 'Off with Their Heads', 'unlock');
					s = offsetMood(s, 'A');
					s = offsetMisc(s, {'K': 5});
					s = addFlag(s, 'Quash');
					s = addFlag(s, 'Eventful');
					if (readSkill(s, 'public') + readSkill(s, 'presence') >= 100) {
						s = addFlag(s, 'Gracefulness');
					}
					else {
						let votes = 1;
						const unap = readFlag(s, 'Unapproved');
						votes += (!readFlag(s, 'Mentor')) ? 0 : (readFlag(s, 'Threshold') && !readFlag(s, 'Lumen')) ? -1 : 1;
						votes += (op && (trob || mole) && !readFlag(s, 'Exuberance')) ? -1 : 1;
						votes += (trob || mole) ? -1 : 1;
						votes += (unap) ? -1 : (readFlag(s, 'Ambition')) ? 1 : 0;
						votes += (unap || op || readFlag(s, 'Spurned')) ? -2 : 2;
						votes += (!den && !trob) ? -1 : 1;
						generateSpecial(page, 'A Trial of Your Peers', 'unlock', votes >= 0);
						if (votes < 0) {
							if (op) {
								generateSpecial(page, 'A Promise Discarded', false);
							}
							generateSpecial(page, 'For the Good of Nova', 'loss', false);
							generateLine(page, 'Window 8');
						}
						else {
							s = addFlag(s, 'Gracefulness');
						}
					}
				}
			}
		}
		const ev = readFlag(s, 'Eventful');
		if (!ev && readFlag(s, 'Stateful')) {
			generateLine(page, 'Confronting An Issue');
			generateOptions(page, c, 17, 13, ['Accuse', 'Ignore'], [true, true]);
			if (!c.hasOwnProperty('week17-13')) {
			}
			else if (c['week17-13'] === '1') {
				s = addFlag(s, 'Eventful');
				generateOptions(page, c, 17, 14, ['Mistake', 'Imprison', 'Execute'], [true, true, true]);
				if (!c.hasOwnProperty('week17-14')) {
				}
				else if (c['week17-14'] === '1') {
					generateLine(page, 'Y');
					s = offsetMood(s, 'Y');
					s = offsetMisc(s, {'Na': -10});
				}
				else if (c['week17-14'] === '2') {
					generateLine(page, 'AD', false);
					generateSpecial(page, 'Family is No Defense', 'unlock');
					s = offsetMood(s, 'AD');
					s = addFlag(s, 'Machination');
				}
				else if (c['week17-14'] === '3') {
					generateLine(page, 'A', false);
					generateSpecial(page, 'Off with Their Heads', 'unlock');
					s = offsetMood(s, 'A');
					s = offsetMisc(s, {'K': 3});
					s = addFlag(s, 'Scapegoat');
				}
			}
			else if (c['week17-13'] === '2') {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
			}
		}
		else if (!ev && readFlag(s, 'Protector') && readFlag(s, 'Stateless') && readSkill(s, 'internal') >= 10) {
			generateLine(page, 'Confronting An Issue');
			generateOptions(page, c, 17, 15, ['Talk', 'Silence'], [true, true]);
			if (!c.hasOwnProperty('week17-15')) {
			}
			else if (c['week17-15'] === '1' && readSkill(s, 'poison') >= 40) {
				generateOptions(page, c, 17, 16, ['Accuse', 'Trust'], [true, true]);
				if (!c.hasOwnProperty('week17-16')) {
				}
				else if (c['week17-16'] === '1') {
					s = addFlag(s, 'Eventful');
					generateOptions(page, c, 17, 17, ['Imprison', 'Execute'], [true, true]);
					if (!c.hasOwnProperty('week17-17')) {
					}
					else if (c['week17-14'] === '1') {
						generateLine(page, 'AD', false);
						generateSpecial(page, 'Family is No Defense', 'unlock');
						s = offsetMood(s, 'AD');
						s = addFlag(s, 'Machination');
					}
					else if (c['week17-14'] === '2') {
						generateLine(page, 'A', false);
						generateSpecial(page, 'Off with Their Heads', 'unlock');
						s = offsetMood(s, 'A');
						s = offsetMisc(s, {'K': 1});
						s = addFlag(s, 'Scapegoat');
					}
				}
			}
			else if (c['week17-15'] === '2') {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
			}
		}
		if (!readFlag(s, 'Eventful')) {
			const sen = readSkill(s, 'sense');
			if (sen >= 80) {
				s = addFlag(s, 'Magician');
			}
			if (readFlag(s, 'Penpal') || readFlag(s, 'Magician')) {
				generateLine(page, 'Piercing an Illusion');
				generateOptions(page, c, 17, 18, ['Talk', 'Avoid'], [true, true]);
				if (c.hasOwnProperty('week17-18') && c['week17-18'] === '1') {
					s = addFlag(s, 'Familiarity');
					generateOptions(page, c, 17, 19, ['Accuse', 'Laurent', 'Offer', 'Secret'], [sen >= 100, true, true, true]);
					if (!c.hasOwnProperty('week17-19')) {
					}
					else if (c['week17-19'] === '1') {
						s = addFlag(s, 'Accusation');
						if (readSkill(s, 'resist') >= 80) {
							generateLine(page, '5DW', false);
							generateSpecial(page, 'A Little Backup', 'unlock');
							s = offsetMood(s, '5DW');
						}
						else {
							generateSpecial(page, 'Game Over', 'loss', false);
							generateLine(page, 'Window 8');
						}
					}
					else if (c['week17-19'] === '2') {
						generateOptions(page, c, 17, 20, ['Push', 'Apologize'], [true, true]);
						if (!c.hasOwnProperty('week17-20')) {
						}
						else if (c['week17-20'] === '1') {
							s = addFlag(s, 'Instigation');
							if (readSkill(s, 'resist') >= 80) {
								generateLine(page, '5DW', false);
								generateSpecial(page, 'A Little Backup', 'unlock');
								s = offsetMood(s, '5DW');
							}
							else {
								generateSpecial(page, 'Game Over', 'loss', false);
								generateLine(page, 'Window 8');
							}
						}
					}
					else if (c['week17-19'] === '3') {
						generateSpecial(page, 'A Gathering of Light', 'unlock');
						s = addFlag(s, 'Minister');
					}
				}
			}
		}
		return [s, page];
	},
	// 18
	(s, c) => {
		const page = new DocumentFragment();
		if (readFlag(s, 'Sappho') && !readFlag(s, 'Gracefulness')) {
			generateLine(page, 'A Present');
			generateSpecial(page, 'The Language of Flowers', 'unlock');
			generateOptions(page, c, 18, 1, ['Accept', 'Reject', 'Regift'], [true, true, true]);
			if (!c.hasOwnProperty('week18-1')) {
			}
			else if (c['week18-1'] === '1') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Bouquet');
			}
			else if (c['week18-1'] === '2') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
			else if (c['week18-1'] === '3') {
				if (readMisc(s, 'K') >= 1) {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					s = addFlag(s, 'Unintended');
				}
				else {
					generateLine(page, 'P');
					s = offsetMood(s, 'P');
				}
			}
		}
		else if (readFlag(s, 'Twostepper') && !readFlag(s, 'Plaything') && !readFlag(s, 'Suitor')) {
			generateLine(page, 'A Present');
			s = addFlag(s, 'Contender');
			generateOptions(page, c, 18, 2, ['Away', 'Display', 'Smash', 'Regift'], [true, true, true, true]);
			if (!c.hasOwnProperty('week18-2')) {
			}
			else if (c['week18-2'] === '1') {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
			}
			else if (c['week18-2'] === '2') {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else if (c['week18-2'] === '3') {
				generateLine(page, 'AW');
				s = offsetMood(s, 'AW');
				s = offsetMisc(s, {'Ca': -5});
			}
			else if (c['week18-2'] === '4') {
				if (readMisc(s, 'K') >= 3) {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					s = addFlag(s, 'Unintended');
				}
				else {
					generateLine(page, 'P');
					s = offsetMood(s, 'P');
				}
			}
		}
		generateLine(page, 'A Presence');
		generateOptions(page, c, 18, 3, ['Greet', 'Shame', 'Insult', 'Trip'], [readSkill(s, 'composure') >= 50, true, true, true]);
		if (!c.hasOwnProperty('week18-3')) {
		}
		else if (c['week18-3'] === '2') {
			if (readSkill(s, 'presence') >= 50) {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
				s = addFlag(s, 'Snuffed');
			}
			else {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
		}
		else if (c['week18-3'] === '3') {
			if (readSkill(s, 'flattery') >= 50) {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
				s = addFlag(s, 'Snuffed');
			}
			else {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
		}
		else if (c['week18-3'] === '4') {
			if (readSkill(s, 'flexible') >= 30) {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Snuffed');
			}
			else {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
		}
		if (readFlag(s, 'Opportunist') || readFlag(s, 'Contender') || readFlag(s, 'Arrangement')) {
			generateLine(page, 'D');
			s = offsetMood(s, 'D');
		}
		if (readSubgroup(s, 'intrigue') >= 40) {
			s = addFlag(s, 'Agents');
			generateOptions(page, c, 18, 4, ['Nobles', 'Commoners', 'Foreigners', 'Assassins', 'Julianna'], [true, true, true, true, readFlag(s, 'Jailbreak')]);
			if (!c.hasOwnProperty('week18-4')) {
			}
			else if (c['week18-4'] === '1') {
				s = addFlag(s, 'Conspirators');
			}
			else if (c['week18-4'] === '2') {
				s = addFlag(s, 'Peasantry');
			}
			else if (c['week18-4'] === '3') {
				s = addFlag(s, 'Outsiders');
			}
			else if (c['week18-4'] === '4') {
				s = addFlag(s, 'Cutthroats');
				generateOptions(page, c, 18, 5, ['Training', 'Guards', 'Punishment'], [true, true, true]);
				if (!c.hasOwnProperty('week18-5')) {
				}
				else if (c['week18-5'] === '1') {
					generateLine(page, '-F-D');
					s = offsetMood(s, '-F-D');
				}
				else if (c['week18-5'] === '2') {
					generateLine(page, 'F, -100R');
					s = offsetMood(s, 'F');
					s = offsetMisc(s, {'R': -100});
					s = addFlag(s, 'Assets');
				}
				else if (c['week18-5'] === '3') {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
					if (!readFlag(s, 'Assassin')) {
						s = offsetMisc(s, {'K': 5, 'Ca': -10});
					}
					else {
						s = offsetMisc(s, {'K': 5});
					}
				}
			}
			else if (c['week18-4'] === '5') {
				generateOptions(page, c, 18, 6, ['Kill', 'Capture'], [true, true]);
				if (!c.hasOwnProperty('week18-6')) {
				}
				else if (c['week18-6'] === '1') {
					generateSpecial(page, 'Off with Their Heads', 'unlock');
					s = offsetMisc(s, {'K': 3});
					s = addFlag(s, 'Wanted');
				}
				generateOptions(page, c, 18, 7, ['Soldiers', 'Reward', 'Ask Around'], [true, true, readSkill(s, 'internal') >= 40 && !readFlag(s, 'Gracefulness') && !readFlag(s, 'Denoble') && !readFlag(s, 'Troublemaker')]);
				if (!c.hasOwnProperty('week18-7')) {
				}
				else if (c['week18-7'] === '1') {
					generateLine(page, '-300R');
					s = offsetMisc(s, {'R': -300});
					s = addFlag(s, 'Fugitive');
				}
				else if (c['week18-7'] === '2') {
					s = addFlag(s, 'Bounty');
					if (readSkill(s, 'decorate') >= 100) {
						s = addFlag(s, 'Portrait');
					}
				}
				else if (c['week18-7'] === '3') {
					s = addFlag(s, 'Inquiry');
				}
			}
		}
		if (readFlag(s, 'Accusation') || readFlag(s, 'Instigation')) {
			generateLine(page, 'F', false);
			generateSpecial(page, 'Casting A Shadow', 'unlock');
		}
		return [s, page];
	},
	// 19
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Revenues');
		const acc = readSkill(s, 'account');
		const g = readMisc(s, 'G');
		generateOptions(page, c, 19, 1, ['Raise', 'Leave', 'Lower'], [true, acc >= 10 && (acc < 50 || g >= 0), acc < 50 || g >= 3000]);
		if (!c.hasOwnProperty('week19-1')) {
		}
		else if (c['week19-1'] === '1') {
			generateLine(page, '3000G');
			if (acc + readSkill(s, 'trade') >= 100) {
				s = offsetMisc(s, {'Na': -10, 'G': 3000});
			}
			else {
				s = offsetMisc(s, {'Ca': -10, 'Na': -10, 'G': 3000});
			}
		}
		else if (c['week19-1'] === '2' && g < 0) {
			generateLine(page, 'AP, 3000G');
			s = offsetMood(s, 'AP');
			s = offsetMisc(s, {'Ca': -10, 'Na': -15, 'G': 3000});
		}
		else if (c['week19-1'] === '3') {
			if (g < 3000) {
				generateLine(page, 'P');
				s = offsetMood(s, 'P');
				s = offsetMisc(s, {'Na': -5});
				generateOptions(page, c, 19, 2, ['Raise', 'Leave'], [true, acc >= 10 && (acc < 50 || g >= 0)]);
				if (!c.hasOwnProperty('week19-2')) {
				}
				else if (c['week19-2'] === '1') {
					generateLine(page, '3000G');
					if (acc + readSkill(s, 'trade') >= 100) {
						s = offsetMisc(s, {'Na': -10, 'G': 3000});
					}
					else {
						s = offsetMisc(s, {'Ca': -10, 'Na': -10, 'G': 3000});
					}
				}
				else if (c['week19-2'] === '2' && g < 0) {
					generateLine(page, 'AP, 3000G');
					s = offsetMood(s, 'AP');
					s = offsetMisc(s, {'Ca': -10, 'Na': -15, 'G': 3000});
				}
			}
			else {
				generateLine(page, '-3000G');
				s = offsetMisc(s, {'Ca': 10, 'Na': 10, 'G': -3000});
			}
		}
		if (readAndFlags(s, ['Opportunist', 'Contender'])) {
			generateLine(page, 'Betrothals');
			if (readMisc(s, 'G') >= 2000) {
				generateOptions(page, c, 19, 3, ['Pay', 'Refuse'], [true, true]);
				if (!c.hasOwnProperty('week19-3')) {
				}
				else if (c['week19-3'] === '1') {
					generateLine(page, '-2000G');
					s = offsetMisc(s, {'G': -2000});
				}
				else if (c['week19-3'] === '2') {
					s = addFlag(s, 'Spurned');
				}
			}
			else {
				s = addFlag(s, 'Spurned');
			}
		}
		if (readFlag(s, 'Inquiry')) {
			generateLine(page, 'F');
			s = offsetMood(s, 'F');
			s = offsetMisc(s, {'Ca': -15});
			s = addFlag(s, 'Outlaw');
		}
		return [s, page];
	},
	// 20
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Possession');
		const sense = readSkill(s, 'sense');
		const ment = readFlag(s, 'Mentor');
		generateOptions(page, c, 20, 1, ['Question', 'Selene', 'Julianna', 'Pardon', 'Imprison', 'Execute'], [sense >= 80, readFlag(s, 'Assistant') && sense >= 30 && sense < 80, ment && sense >= 30 && sense < 80, ment || sense < 30 || sense >= 80, true, true]);
		if (!c.hasOwnProperty('week20-1')) {
		}
		else if (c['week20-1'] === '1') {
			s = addFlag(s, 'Corruption');
			if (readSkill(s, 'resist') >= 60) {
				generateLine(page, 'A', false);
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'Ca': 10, 'Na': 10});
			}
			else if (readSkill(s, 'flexible') >= 50) {
				generateLine(page, 'F', false);
				s = offsetMood(s, 'F');
			}
			else if (readSkill(s, 'reflexes') + readSkill(s, 'running') >= 50) {
				generateLine(page, 'F', false);
				s = offsetMood(s, 'F');
				s = offsetMisc(s, {'Na': -5});
			}
			else {
				generateSpecial(page, 'Choked on Magical Chains', 'death');
			}
			generateSpecial(page, 'A Little Backup', 'unlock');
		}
		else if (c['week20-1'] === '2') {
			s = addFlag(s, 'Purification');
		}
		else if (c['week20-1'] === '3') {
			s = addFlag(s, 'Tutelage');
			if (readSkill(s, 'composure') < 10 && readSkill(s, 'meditate') < 10) {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'Ca': -5, 'Na': -5});
				generateOptions(page, c, 20, 2, ['Pardon', 'Imprison', 'Execute'], [true, true, true]);
				if (!c.hasOwnProperty('week20-2')) {
				}
				else if (c['week20-2'] === '1') {
					generateLine(page, 'D');
					s = offsetMood(s, 'D');
					s = offsetMisc(s, {'Ca': -10});
				}
				else if (c['week20-2'] === '2') {
					s = addFlag(s, 'Bowed');
				}
				else if (c['week20-2'] === '3') {
					s = addFlag(s, 'Demons');
				}
			}
			else {
				generateOptions(page, c, 20, 3, ['Stop Waiting', 'Continue'], [true, true]);
				if (!c.hasOwnProperty('week20-3')) {
				}
				else if (c['week20-3'] === '1') {
					generateOptions(page, c, 20, 4, ['Pardon', 'Imprison', 'Execute'], [true, true, true]);
					if (!c.hasOwnProperty('week20-4')) {
					}
					else if (c['week20-4'] === '1') {
						generateLine(page, 'D');
						s = offsetMood(s, 'D');
						s = offsetMisc(s, {'Ca': -10});
					}
					else if (c['week20-4'] === '2') {
						s = addFlag(s, 'Bowed');
					}
					else if (c['week20-4'] === '3') {
						s = addFlag(s, 'Demons');
					}
				}
				else if (c['week20-3'] === '2') {
					if (readSkill(s, 'wield') < 30 && readSkill(s, 'resist') < 40) {
						if (readSkill(s, 'flexible') > 50) {
							generateLine(page, 'F', false);
							s = offsetMood(s, 'F');
						}
						else if (readSkill(s, 'reflexes') + readSkill(s, 'running') >= 50) {
							generateLine(page, 'F', false);
							s = offsetMood(s, 'F');
							s = offsetMisc(s, {'Na': -5});
						}
						else {
							generateSpecial(page, 'Choked on Magical Chains', 'death');
						}
						generateSpecial(page, 'A Little Backup');
					}
					else if (readSkill(s, 'public') + readSkill(s, 'presence') >= 50) {
						s = offsetMisc(s, {'Ca': 5, 'Na': 5});
						s = addFlag(s, 'Powerful');
					}
					else {
						generateLine(page, 'A');
						s = offsetMood(s, 'A');
					}
				}
			}
		}
		else if (c['week20-1'] === '4') {
			generateLine(page, 'D');
			s = offsetMood(s, 'D');
			s = offsetMisc(s, {'Ca': -10});
		}
		else if (c['week20-1'] === '5') {
			s = addFlag(s, 'Bowed');
		}
		else if (c['week20-1'] === '6') {
			generateLine(page, 'W', false);
			s = offsetMood(s, 'W');
			s = addFlag(s, 'Demons');
			generateSpecial(page, 'Off with Their Heads', 'unlock');
		}
		if (readAndFlags(s, ['Outsiders', 'Spurned'])) {
			generateLine(page, 'Pettiness');
			generateOptions(page, c, 20, 5, ['Invest', 'Soldiers', 'Ignore'], [readSkill(s, 'trade'), true, true]);
			if (!c.hasOwnProperty('week20-5')) {
			}
			else if (c['week20-5'] === '1') {
				generateLine(page, '-600G');
				s = offsetMisc(s, {'G': -600});
				s = addFlag(s, 'Foresight');
			}
			else if (c['week20-5'] === '2') {
				s = offsetMisc(s, {'R': -1200});
				s = addFlag(s, 'Peacekeepers');
			}
		}
		return [s, page];
	},
	// 21
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Scofflaws');
		if (readFlag(s, 'Bowed')) {
			generateLine(page, '-250G');
			s = offsetMisc(s, {'Ca': -10, 'G': -250});
			if (readAndFlags(s, ['Bounty', 'Wanted'])) {
				if (readFlag(s, 'Portrait')) {
					const f = (readMoodAxis(s, 'F') < 0) ? '-5A' : '-F';
					generateLine(page, f + ' -300G', false);
					generateSpecial(page, 'The Price of Blood', 'unlock');
					s = offsetMood(s, f);
					s = offsetMisc(s, {'Ca': -10, 'G': -300});
				}
				else {
					s = offsetMisc(s, {'Ca': -10});
				}
			}
		}
		else if (readFlag(s, 'Demons')) {
			s = offsetMisc(s, {'Ca': -5, 'Na': -5});
			if (readFlag(s, 'Mentor')) {
				s = offsetMisc(s, {'Ca': -5, 'Na': -5});
			}
			else if (readAndFlags(s, ['Bounty', 'Wanted'])) {
				if (readFlag(s, 'Portrait')) {
					const f = (readMoodAxis(s, 'F') < 0) ? '-5A' : '-F';
					generateLine(page, f + ' -300G', false);
					generateSpecial(page, 'The Price of Blood', 'unlock');
					s = offsetMood(s, f);
					s = offsetMisc(s, {'Ca': -10, 'G': -300});
				}
				else {
					s = offsetMisc(s, {'Ca': -10});
				}
			}
		}
		else if (readAndFlags(s, ['Bounty', 'Wanted', 'Portrait'])) {
			const f = (readMoodAxis(s, 'F') < 0) ? '-5A' : '-F';
			generateLine(page, f + ' -300G', false);
			generateSpecial(page, 'The Price of Blood', 'unlock');
			s = offsetMood(s, f);
			s = offsetMisc(s, {'Ca': -10, 'G': -300});
		}
		else if (readAndFlags(s, ['Bounty', 'Wanted'])) {
			s = offsetMisc(s, {'Ca': -10});
		}
		else if (readAndNotFlags(s, ['Fugitive', 'Bounty'])) {
			s = addFlag(s, 'Saga');
			generateOptions(page, c, 21, 1, ['Funny', 'Terrible'], [true, true]);
			if (!c.hasOwnProperty('week21-1')) {
			}
			else if (c['week21-1'] === '1'){
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else if (c['week21-1'] === '2'){
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
			generateOptions(page, c, 21, 2, ['Climb', 'Ignore'], [true, true]);
			if (!c.hasOwnProperty('week21-2')) {
			}
			else if (c['week21-2'] === '1'){
				const climb = readSkill(s, 'climbing');
				if (climb >= 100) {
					generateLine(page, 'CW');
					s = offsetMood(s, 'CW');
				}
				else if (climb < 40){
					generateLine(page, 'I2F3Y');
					s = offsetMood(s, 'I2F3Y');
					s = offsetMisc(s, {'Ca': -5});
				}
			}
			else if (c['week21-2'] === '2'){
				s = offsetMisc(s, {'Ca': -5});
			}
		}
		return [s, page];
	},
	// 22
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Regency');
		generateOptions(page, c, 22, 1, ['Arisse', 'Grandfather', 'Marry', 'Uncle', 'Adele'], [true, true, readAndNotFlags(s, ['Opportunist', 'Contender']), true, readFlag(s, 'Naunt')]);
		if (!c.hasOwnProperty('week22-1')) {
		}
		else if (c['week22-1'] === '1') {
			s = addFlag(s, 'Courtesan');
		}
		else if (c['week22-1'] === '2') {
			s = addFlag(s, 'Lineage');
		}
		else if (c['week22-1'] === '3') {
			s = offsetMisc(s, {'Ca': -10});
			s = addFlag(s, 'Ward');
		}
		else if (c['week22-1'] === '4') {
			s = offsetMisc(s, {'Na': -10});
			s = addFlag(s, 'Protectorate');
		}
		else if (c['week22-1'] === '5') {
			generateLine(page, 'C');
			s = offsetMood(s, 'C');
		}
		return [s, page];
	},
	// 23
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Patronage');
		if (readMisc(s, 'G') >= 250) {
			generateOptions(page, c, 23, 1, ['Accept', 'Test', 'Decline'], [true, readSkill(s, 'instrument') + readSkill(s, 'voice') >= 50 && readSubgroup(s, 'intrigue') >= 20, true]);
			if (!c.hasOwnProperty('week23-1')) {
			}
			else if (c['week23-1'] === '1') {
				generateLine(page, '-250G');
				s = offsetMisc(s, {'Ca': 10});
				s = addFlag(s, 'Musician');
			}
			else if (c['week23-1'] === '2') {
				generateLine(page, '-250G', false);
				generateSpecial(page, 'A Dangerous Juggler', 'unlock');
				s = offsetMisc(s, {'Ca': 10});
				s = addFlag(s, 'Agent');
			}
		}
		return [s, page];
	},
	// 24
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Happenings');
		if (readFlag(s, 'Ward')) {
			if (readSubgroup(s, 'animal') >= 30) {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else {
				generateLine(page, 'P');
				s = offsetMood(s, 'P');
			}
		}
		else if (readFlag(s, 'Conspirators') && (readMisc(s, 'Na') <= -40 || readOrFlags(s, ['Lineage', 'Protectorate']))) {
			const ag = readFlag(s, 'Agent');
			generateOptions(page, c, 24, 1, ['Arrest', 'Kill', 'Wait', 'Musician'], [true, true, !ag, ag]);
			if (!c.hasOwnProperty('week24-1')) {
			}
			else if (c['week24-1'] === '1') {
				s = offsetMisc(s, {'R': -400})
				s = addFlag(s, 'Traitor');
			}
			else if (c['week24-1'] === '2') {
				generateSpecial(page, 'Make It Look Like An Accident', 'unlock');
				s = offsetMisc(s, {'K': 3})
				s = addFlag(s, 'Prevention');
			}
			else if (c['week24-1'] === '4') {
				s = addFlag(s, 'Subterfuge');
			}
		}
		return [s, page];
	},
	// 25
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'A Forecast');
		const g = readMisc(s, 'G');
		if (g >= 400 && (readFlag(s, 'Outsiders') || (readSkill(s, 'logs') >= 70 && readSkill(s, 'trade') >= 40))) {
			s = addFlag(s, 'Appropriations');
			generateOptions(page, c, 25, 1, ['Warships', 'Wait'], [true, true]);
			if (!c.hasOwnProperty('week25-1')) {
			}
			else if (c['week25-1'] === '1') {
				generateLine(page, '-4000G');
				s = offsetMisc(s, {'G': -4000});
				s = addFlag(s, 'Mariners');
			}
		}
		else if (readSkill(s, 'divinate') >= 90) {
			s = addFlag(s, 'Foreboding');
			generateOptions(page, c, 25, 2, ['Recruit', 'Wait'], [true, true]);
			if (!c.hasOwnProperty('week25-2')) {
			}
			else if (c['week25-2'] === '1' && g >= 1000) {
				generateLine(page, '-1000G');
				s = offsetMisc(s, {'G': -1000, 'R': 1000});
			}
			else if (c['week25-2'] === '2') {
				const f = (readMoodAxis(s, 'F') < 0) ? '-5A' : '-F';
				generateLine(page, f);
				s = offsetMood(s, f);
			}
		}
		else {
			generateLine(page, 'C');
			s = offsetMood(s, 'C');
		}
		if (readFlag(s, 'Traitor')) {
			s = offsetMisc(s, {'Na': -10});
		}
		else if (readFlag(s, 'Subterfuge') && readMisc(s, 'Na') <= -40) {
			generateOptions(page, c, 25, 3, ['Arrest', 'Kill', 'Ally'], [true, true, readSkill(s, 'strategy') >= 40 || readSkill(s, 'public') >= 40]);
			if (!c.hasOwnProperty('week25-3')) {
			}
			else if (c['week25-3'] === '1') {
				s = offsetMisc(s, {'R': -400});
				s = addFlag(s, 'Re-Traitor');
			}
			else if (c['week25-3'] === '2') {
				generateSpecial(page, 'Make It Look Like An Accident', 'unlock');
				s = offsetMisc(s, {'K': 3});
				s = addFlag(s, 'Re-Prevention');
			}
			else if (c['week25-3'] === '3') {
				s = addFlag(s, 'Parley');
			}
		}
		return [s, page];
	},
	// 26
	(s, c) => {
		const page = new DocumentFragment();
		if (readFlag(s, 'Lineage') && (!readFlag(s, 'Opportunist') || readFlag(s, 'Contender'))) {
			generateLine(page, 'F');
			s = offsetMood(s, 'F');
			s = offsetMisc(s, {'Na': -20});
			generateOptions(page, c, 26, 1, ['Ishtar', 'Talasse', 'No One'], [true, readSkill(s, 'forint') >= 70, true]);
			if (!c.hasOwnProperty('week26-1')) {
			}
			else if (c['week26-1'] === '1') {
				generateOptions(page, c, 26, 2, ['Arrest', 'Execute'], [true, true]);
				if (!c.hasOwnProperty('week26-2')) {
				}
				else if (c['week26-2'] === '1') {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
				}
				else if (c['week26-2'] === '2') {
					generateLine(page, 'A');
					generateSpecial(page, 'Off with Their Heads', 'unlock');
					s = offsetMood(s, 'A');
					s = offsetMisc(s, {'K': 3});
				}
			}
			else if (c['week26-1'] === '2') {
				s = addFlag(s, 'Terrorism');
			}
			else if (c['week26-1'] === '3') {
				generateLine(page, 'D');
				s = offsetMood(s, 'D');
			}
			generateOptions(page, c, 26, 3, ['Novan', 'Talarist', 'Wait'], [true, true, true]);
			if (!c.hasOwnProperty('week26-3')) {
			}
			else if (c['week26-3'] === '1') {
				s = addFlag(s, 'Succession');
				const prev = readFlag(s, 'Prevention');
				generateOptions(page, c, 26, 4, ['Child of Kigal', 'Lillah', 'Heir of Lillah', 'Administrator', "Don't Care"], [true, !prev, prev, true, true]);
				if (!c.hasOwnProperty('week26-4')) {
				}
				else if (c['week26-4'] === '4') {
					s = offsetMisc(s, {'Ca': 10});
				}
				else if (c['week26-4'] === '5') {
					generateLine(page, 'P');
					s = offsetMood(s, 'P');
					s = offsetMisc(s, {'Ca': 10, 'Na': -10});
				}
			}
			else if (c['week26-3'] === '2') {
				generateSpecial(page, 'No Other Rulers Before Me', 'unlock');
				s = offsetMisc(s, {'Ca': -10});
				s = addFlag(s, 'Favoritism');
			}
			else if (c['week26-3'] === '3') {
				s = offsetMisc(s, {'Ca': -5});
				s = addFlag(s, 'Estate');
			}
			if (readFlag(s, 'Re-Traitor')) {
				s = offsetMisc(s, {'Na': -10});
			}
		}
		else if (readOrFlags(s, ['Spurned', 'Ward'])) {
			if (readFlag(s, 'Foresight')) {
				s = offsetMisc(s, {'G': 800});
			}
			else if (readMisc(s, 'G') < 890) {
				s = offsetMisc(s, {'Ca': -10});
			}
			else {
				generateOptions(page, c, 26, 5, ['Aid', 'Ignore'], [true, true]);
				if (!c.hasOwnProperty('week26-5')) {
				}
				else if (c['week26-5'] === '1') {
					s = offsetMisc(s, {'Ca': 10, 'G': -890});
				}
				else if (c['week26-5'] === '2') {
					s = offsetMisc(s, {'Ca': -10});
				}
			}
			if (readFlag(s, 'Re-Traitor')) {
				s = offsetMisc(s, {'Na': -10});
			}
		}
		else if (!readFlag(s, 'Saga')) {
			if (readFlag(s, 'Re-Traitor')) {
				s = offsetMisc(s, {'Na': -10});
			}
			s = addFlag(s, 'Saga');
			generateOptions(page, c, 26, 6, ['Funny', 'Terrible'], [true, true]);
			if (!c.hasOwnProperty('week26-6')) {
			}
			else if (c['week26-6'] === '1') {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else if (c['week26-6'] === '2') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
			generateOptions(page, c, 26, 7, ['Climb', 'Ignore'], [true, true]);
			if (!c.hasOwnProperty('week26-7')) {
			}
			else if (c['week26-7'] === '1') {
				const climb = readSkill(s, 'climbing');
				if (climb >= 100) {
					generateLine(page, 'CW');
					s = offsetMood(s, 'CW');
				}
				else if (climb < 40) {
					generateLine(page, 'I2F4Y');
					s = offsetMood(s, 'I2F4Y');
					s = offsetMisc(s, {'Ca': -5});
				}
			}
			else if (c['week26-7'] === '2') {
				s = offsetMisc(s, {'Ca': -5});
			}
		}
		else if (readFlag(s, 'Re-Traitor')) {
			s = offsetMisc(s, {'Na': -10});
		}
		else {
			generateLine(page, 'C');
			s = offsetMood(s, 'C');
		}
		return [s, page];
	},
	// 27
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Invasion');
		if (readFlag(s, 'Succession')) {
			if (readOrFlags(s, ['Peacekeepers', 'Terrorism'])) {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else {
				generateLine(page, 'P');
				s = offsetMood(s, 'P');
				if (readFlag(s, 'Foresight')) {}
				else if (readMisc(s, 'G') < 550) {
					s = offsetMisc(s, {'Ca': -10, 'Na': -10});
				}
				else {
					generateLine(page, '-550G');
					s = offsetMisc(s, {'G': -550});
				}
				s = offsetMisc(s, {'R': -1200});
			}
		}
		generateLine(page, 'Party Planning');
		if (readFlag(s, 'Parley') && readSkill(s, 'court') < 80) {
			generateLine(page, 'P');
			s = offsetMood(s, 'P');
		}
		generateOptions(page, c, 27, 1, ['Go', 'Stay'], [true, true]);
		if (!c.hasOwnProperty('week27-1')) {
		}
		else if (c['week27-1'] === '1') {
			generateLine(page, 'C');
			s = offsetMood(s, 'C');
		}
		else if (c['week27-1'] === '2') {
			s = addFlag(s, 'Antisocial');
		}
		return [s, page];
	},
	// 28
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Sudbury');
		if (readFlag(s, 'Antisocial')) {
			generateLine(page, 'L');
			s = offsetMood(s, 'L');
			if (readSkill(s, 'court') < 80) {
				s = offsetMisc(s, {'Na': -10});
			}
			else if (readFlag(s, 'Roguish')) {
				generateOptions(page, c, 28, 1, ['Sneak Out', 'Ignore'], [true, true]);
				if (!c.hasOwnProperty('week28-1')) {
				}
				else if (c['week28-1'] === '1') {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					generateOptions(page, c, 28, 2, ['Accept', 'Test', 'Refuse'], [true, readSkill(s, 'poison') >= 70, true]);
					if (!c.hasOwnProperty('week28-2')) {
					}
					else if (c['week28-2'] === '1') {
						s = addFlag(s, 'Cookies');
					}
					else if (c['week28-2'] === '2') {
						s = addFlag(s, 'Cookies');
						s = addFlag(s, 'Taster');
					}
					if (readFlag(s, 'Cookies')) {
						generateLine(page, 'C');
						s = offsetMood(s, 'C');
					}
				}
			}
		}
		else {
			if (readMisc(s, 'Ca') <= -45 || readAndNotFlags(s, ['Accusation', 'Instigation', 'Minister'])) {
				if (readFlag(s, 'Assets')) {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
				}
				else if (readSkill(s, 'archery') + readSkill(s, 'reflexes') >= 100) {
					generateLine(page, 'FD');
					s = offsetMood(s, 'FD');
				}
				else {
					generateLine(page, '3F');
					s = offsetMood(s, '3F');
					if (readSkill(s, 'battle') < 70 || (readSkill(s, 'composure') < 50 && readSkill(s, 'meditate') < 50)) {
						generateSpecial(page, 'Taken An Arrow To The Gut', 'death');
					}
				}
			}
			if (readAndNotFlags(s, ['Gracefulness', 'Troublemaker', 'Denoble'])) {
				generateOptions(page, c, 28, 3, ['Gwenelle', 'Lieke', 'Both'], [true, true, readSkill(s, 'flattery') >= 60]);
				if (!c.hasOwnProperty('week28-3')) {
				}
				else if (c['week28-3'] === '1') {
					generateLine(page, 'DW');
					s = offsetMood(s, 'DW');
				}
				else if (c['week28-3'] === '2') {
					generateLine(page, 'Y');
					s = offsetMood(s, 'Y');
					s = offsetMisc(s, {'Na': -10});
				}
			}
			if (readSkill(s, 'novan') >= 90 || readSkill(s, 'lore') >= 60) {
				s = addFlag(s, 'Gossip');
				generateOptions(page, c, 28, 4, ['Help', 'Discourage', 'Parents'], [true, true, true]);
				if (!c.hasOwnProperty('week28-4')) {
				}
				else if (c['week28-4'] === '1') {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					s = addFlag(s, 'Forest');
				}
				else if (c['week28-4'] === '2' && readSubgroup(s, 'conversation') >= 75) {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
					s = addFlag(s, 'Horrify');
				}
				else if (c['week28-4'] === '3') {
					s = offsetMisc(s, {'Na': 10});
					s = addFlag(s, 'Tattle');
				}
			}
			if (readFlag(s, 'Parley')) {
				if (readFlag(s, 'Ward')) {
					generateSpecial(page, 'Keep Your Friends Close', 'unlock');
					s = addFlag(s, 'Advisor');
					if (!readFlag(s, 'Horrify')) {
						s = addFlag(s, 'Tattle');
					}
				}
				else {
					generateOptions(page, c, 28, 5, ['Accept', 'Reject'], [true, true]);
					if (!c.hasOwnProperty('week28-5')) {
					}
					else if (c['week28-5'] === '1') {
						generateLine(page, 'Y', false);
						generateSpecial(page, 'For the Good of Nova', 'unlock', false);
						generateSpecial(page, 'Keep Your Friends Close', 'unlock', false);
						s = offsetMood(s, 'Y');
						s = addFlag(s, 'Alliance');
						s = addFlag(s, 'Advisor');
						if (!readFlag(s, 'Horrify')) {
							s = addFlag(s, 'Tattle');
						}
						if (readOrFlags(s, ['Contender', 'Opportunist'])) {
							s = addFlag(s, 'Supplanted');
							generateSpecial(page, 'A Promise Discarded', 'unlock');
						}
						else {
							generateLine(page, '');
						}
					}
				}
			}
			generateLine(page, '-L');
			s = offsetMood(s, '-L');
			if (readOrFlags(s, ['Accusation', 'Instigation'])) {
				generateLine(page, 'D');
				s = offsetMood(s, 'D');
			}
		}
		return [s, page];
	},
	// 29
	(s, c) => {
		const page = new DocumentFragment();
		if (readMisc(s, 'Na') <= -40 && readAndNotFlags(s, ['Prevention', 'Re-Prevention', 'Advisor'])) {
			generateSpecial(page, 'A Land Divided', 'unlock');
			s = addFlag(s, 'Divided');
			if (readFlag(s, 'Forest') && !readFlag(s, 'Tattle')) {
				generateOptions(page, c, 29, 1, ['Send', 'Hostage'], [true, true]);
				if (!c.hasOwnProperty('week29-1')) {
				}
				else if (c['week29-1'] === '1') {
					s = offsetMisc(s, {'K': 1});
				}
				else if (c['week29-1'] === '2') {
					s = offsetMisc(s, {'K': 1});
					s = addFlag(s, 'Hostage');
					generateSpecial(page, 'A Hostage to Fortune', 'unlock');
				}
			}
			generateOptions(page, c, 29, 2, ['Agree', 'Reject'], [true, true]);
			if (!c.hasOwnProperty('week29-2')) {
			}
			else if (c['week29-2'] === '1') {
					s = offsetMisc(s, {'Ca': -10});
					s = addFlag(s, 'Conscription');
			}
		}
		else if (readFlag(s, 'Forest') && !readFlag(s, 'Tattle')) {
			generateLine(page, 'Adventure:');
			generateOptions(page, c, 29, 3, ['Go With', 'Do Not Go', 'Talk Out', 'Family'], [true, true, true, readSubgroup(s, 'conversation') >= 40]);
			if (!c.hasOwnProperty('week29-3')) {
			}
			else if (c['week29-3'] === '1') {
				s = addFlag(s, 'Adventure');
				generateSpecial(page, 'Things That Go Bump In The Night', 'unlock')
				if (readSkill(s, 'herbs') < 70 || readSkill(s, 'running') < 50) {
					generateSpecial(page, 'Fallen Victim to Monsters', 'death')
				}
				generateLine(page, '10F');
				s = offsetMood(s, '10F');
				if (readSkill(s, 'horses') >= 70) {
					generateSpecial(page, 'There And Back Again', 'unlock')
				}
				else {
					generateOptions(page, c, 29, 4, ['Leave', 'Aid'], [true, true]);
					if (!c.hasOwnProperty('week29-4')) {
					}
					else if (c['week29-4'] === '1') {
						generateSpecial(page, 'There And Back Again', 'unlock')
						s = offsetMisc(s, {'K': 3});
						s = addFlag(s, 'Abandoned');
					}
					else if (c['week29-4'] === '2') {
						s = offsetMisc(s, {'K': -3});
						if (readSkill(s, 'dance') < 30) {
							generateSpecial(page, 'Fallen Victim To Monsters', 'death')
						}
						else {
							generateSpecial(page, 'There And Back Again', 'unlock')
						}
					}
				}
			}
			else if (c['week29-3'] === '2' || c['week29-3'] === '3') {
				s = addFlag(s, 'Confidence');
			}
			else if (c['week29-3'] === '4') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = addFlag(s, 'Secrets');
			}
		}
		else if (!readFlag(s, 'Advisor') && readOrFlags(s, ['Outsiders', 'Appropriations', 'Foreboding'])) {
			generateLine(page, 'Conflict:');
			generateOptions(page, c, 29, 5, ['Agree', 'Reject'], [true, true]);
			if (!c.hasOwnProperty('week29-5')) {
			}
			else if (c['week29-5'] === '1') {
				s = offsetMisc(s, {'Ca': -10});
				s = offsetMisc(s, {'R': 879});
			}
		}
		else if (!readFlag(s, 'Advisor')) {
			generateLine(page, 'Conflict:');
			if (readOrFlags(s, ['Prevention', 'Re-Prevention'])) {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
			}
			else {
				generateOptions(page, c, 29, 6, ['Keep', 'Regift'], [true, true]);
				if (!c.hasOwnProperty('week29-6')) {
				}
				else if (c['week29-6'] === '2') {
					if (readMisc(s, 'K') >= 3) {
						generateLine(page, 'W');
						s = offsetMood(s, 'W');
						s = addFlag(s, 'Unintended');
					}
					else  {
						generateLine(page, 'P');
						s = offsetMood(s, 'P');
					}
				}
			}
		}
		return [s, page];
	},
	// 30
	(s, c) => {
		const page = new DocumentFragment();
		if (readFlag(s, 'Divided')) {
			generateLine(page, 'Treating:');
			if (readFlag(s, 'Hostage')) {
				generateOptions(page, c, 30, 1, ['Peace', 'Ransom', 'Exile'], [true, true, true]);
				if (!c.hasOwnProperty('week30-1')) {
				}
				else if (c['week30-1'] === '1') {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
					s = offsetMisc(s, {'Na': 5});
					s = addFlag(s, 'United');
				}
				else if (c['week30-1'] === '2') {
					generateLine(page, 'W, 2000G');
					s = offsetMood(s, 'W');
					s = offsetMisc(s, {'Na': -10, 'G': 2000});
					s = addFlag(s, 'United');
				}
				else if (c['week30-1'] === '3') {
					generateLine(page, 'AW');
					s = offsetMood(s, 'AW');
					const k = readMisc(s, 'K');
					if (k > 10 || readSkill(s, 'presence') + 10 * k >= 150) {
						s = offsetMisc(s, {'Na': -10});
						s = addFlag(s, 'Exiles');
						s = addFlag(s, 'United');
					}
				}
			}
			else if (!readFlag(s, 'Ward') && (!readFlag(s, 'Contender') || readFlag(s, 'Supplanted')) && (!readFlag(s, 'Opportunist') || readOrFlags(s, ['Contender', 'Supplanted']))) {
				generateOptions(page, c, 30, 2, ['Agree', 'Refuse', 'Compromise'], [true, true, true]);
				if (!c.hasOwnProperty('week30-2')) {
				}
				else if (c['week30-2'] === '1') {
					generateLine(page, 'Y', false);
					generateSpecial(page, 'For the Good of Nova', 'loss');
					s = offsetMood(s, 'Y');
					s = offsetMisc(s, {'Na': 10});
				}
				else if (c['week30-2'] === '2') {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
				}
				else if (c['week30-2'] === '3') {
					if (readSkill(s, 'public') < 70) {
						generateOptions(page, c, 30, 3, ['Agree', 'Refuse'], [true, true]);
						if (!c.hasOwnProperty('week30-3')) {
						}
						else if (c['week30-3'] === '1') {
							s = offsetMisc(s, {'Na': 10});
							generateSpecial(page, 'For the Good of Nova', 'loss', false);
							generateLine(page, 'Window 8');
						}
						else if (c['week30-3'] === '2') {
							generateLine(page, 'A');
							s = offsetMood(s, 'A');
						}
					}
					else {
						s = offsetMisc(s, {'Na': 10});
						s = addFlag(s, 'United');
						s = addFlag(s, 'Armistice');
						generateSpecial(page, 'For the Good of Nova', 'unlock');
					}
				}
			}
			else {
				generateOptions(page, c, 30, 4, ['Accept', 'Refuse'], [true, true]);
				if (!c.hasOwnProperty('week30-4')) {
				}
				else if (c['week30-4'] === '1') {
					generateSpecial(page, 'Game Over', 'loss');
				}
				else if (c['week30-4'] === '2') {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
				}
			}
		}
		else if (readOrFlags(s, ['Confidence', 'Abandoned'])) {
			generateLine(page, 'Missing:');
			generateOptions(page, c, 30, 5, ['Accept', 'Reject'], [true, true]);
			if (!c.hasOwnProperty('week30-5')) {
			}
			else if (c['week30-5'] === '1') {
				generateLine(page, 'DP');
				s = offsetMood(s, 'DP');
			}
			else if (c['week30-5'] === '2') {
				s = offsetMisc(s, {'K': 1});
			}
		}
		else if (!readFlag(s, 'Tattle') && readAndFlags(s, ['Forest', 'Secrets'])) {
			generateLine(page, 'Found');
			generateLine(page, 'C');
			s = offsetMood(s, 'C');
		}
		else if (readFlag(s, 'Adventure') && !readFlag(s, 'Abandoned')) {
			generateLine(page, 'Missing');
			generateLine(page, 'A5P');
			s = offsetMood(s, 'A5P');
		}
		else if (readFlag(s, 'Supplanted') && readOrFlags(s, ['Tattle', 'Horrify'])) {
			generateLine(page, 'Consequence:');
			if (readFlag(s, 'Contender')) {
				const cm = readSkill(s, 'court');
				const cs = readSubgroup(s, 'conversation');
				generateOptions(page, c, 30, 6, ['Arisse', 'Pay', 'Angry', 'Polite', 'Ignore'], [cm < 60, cm >= 60, cm < 60 && cs >= 50, cm < 60, true]);
				if (!c.hasOwnProperty('week30-6')) {
				}
				else if (c['week30-6'] === '1') {
					generateLine(page, 'Y');
					s = offsetMood(s, 'Y');
					s = addFlag(s, 'Heartbroken');
					s = addFlag(s, 'Tactful');
				}
				else if (c['week30-6'] === '2') {
				 	if (readMisc(s, 'G') >= 200) {
						generateLine(page, '-200G');
						s = offsetMisc(s, {'G': -200});
					}
					else {
						s = addFlag(s, 'Heartbroken');	
					}
				}
				else if (c['week30-6'] === '3') {
					s = offsetMisc(s, {'Na': -5});
					s = addFlag(s, 'Heartbroken');	
				}
				else if (c['week30-6'] === '4') {
					if (cs >= 50) {
						generateLine(page, 'W');
						s = offsetMood(s, 'W');
						s = addFlag(s, 'Unconsummate');	
					}
					else {
						generateLine(page, 'P');
						s = offsetMood(s, 'P');
						s = offsetMisc(s, {'Na': -5});
						s = addFlag(s, 'Heartbroken');	
					}
				}
				else if (c['week30-6'] === '5') {
					s = addFlag(s, 'Heartbroken');	
				}
			}
			else {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
				s = offsetMisc(s, {'Na': -10});
				if (readFlag(s, 'Suitor')) {
					s = offsetMisc(s, {'Ca': -5, 'Na': -5});
				}
			}
		}
		return [s, page];
	},
	// 31
	(s, c) => {
		const page = new DocumentFragment();
		if (readFlag(s, 'Divided') && !readFlag(s, 'United')) {
			generateLine(page, 'Rebellion:');
			const csn = readFlag(s, 'Courtesan');
			const ant = readFlag(s, 'Antisocial');
			const lp = 0.55 + ((csn) ? -0.1 : 0.0) + ((ant) ? -0.1 : 0.0);
			const rp = 0.45 + ((csn) ? 0.1 : 0.0) + ((ant) ? 0.1 : 0.0);
			const R = readMisc(s, 'R');
			let la = R * lp + ((readFlag(s, 'Conscription')) ? 623 : 0);
			let ra = R * rp + ((readOrFlags(s, ['Traitor', 'Re-Traitor'])) ? 200 : 0);
			if (readFlag(s, 'Printing')) {
				const ncon = !readFlag(s, 'Conscription');
				const ca = readMisc(s, 'Ca');
				let prop = ra;
				if (ca < -10 || ncon && ca < 0) {
					prop = 0;
				}
				else if (ca < 0 || ncon && ca < 10) {
					prop *= 0.05;
				}
				else if (ca < 10 || ncon && ca < 20) {
					prop *= 0.10;
				}
				else if (ca < 20 || ncon && ca < 30) {
					prop *= 0.15;
				}
				else {
					prop *= 0.20;
				}
				prop = Math.floor(prop);
				la += prop;
				ra -= prop;
			}
			let cb = 0;
			cb += (readSubgroup(s, 'military') < 1) ? -0.05 : 0;
			cb += (determineMood(s) === 'F') ? -0.2 : 0;
			const wield = readSkill(s, 'wield');
			if (wield >= 90) {
				cb += 0.55;
			}
			else if (wield >= 70) {
				cb += 0.25;
			}
			else if (wield >= 40) {
				cb += 0.15;
			}
			else if (readFlag(s, 'Lumen')) {
				cb += 0.05;
			}
			const strat = readSkill(s, 'strategy');
			const lgst = readSkill(s, 'logs') + strat;
			cb += 0.01 * lgst;
			const rs = ra * 0.5;
			const ls = la * Math.max(0.1, cb);
			if (ls < rs) {
				generateSpecial(page, 'Game Over', 'loss', false);
				generateLine(page, 'Window 8');
			}
			let ll = 0.3 * ra * ((wield >= 90) ? 0.5 : 1) * ((strat >= 100 || lgst >= 170) ? 0.5 : 1);
			let rl = 0.3 * la * ((wield >= 90) ? 2 : 1) * ((strat >= 100) ? 0.5 : 1);
			const k = readMisc(s, 'K');
			rl += (k >= 10) ? 0.1 * ra : 0;
			const bmh = readSkill(s, 'battle') + readSkill(s, 'herbs');
			if (bmh > 0) {
				ll -= 2 * bmh;
				if (k < 5) {
					rl -= bmh;
				}
			}
			else if (readFlag(s, 'Hospital')) {
				ll *= 0.5;
				if (k < 10) {
					rl *= 0.5;
				}
			}
			ll = Math.min(Math.max(0, Math.floor(ll)), la - 200)
			rl = Math.min(Math.max(0, Math.floor(rl)), ra - 200)
			generateLine(page, 'Spoils of War: 1000G');
			const r = readMisc(s, 'R');
			s = offsetMisc(s, {'G': 1000, 'R': la + ra - r - ll - rl});
		}
		else if (readSkill(s, 'divinate') >= 40) {
			generateLine(page, 'Doom:');
			generateLine(page, 'F');
			s = offsetMood(s, 'F');
			if (readFlag(s, 'United')) {
				generateOptions(page, c, 31, 1, ['Send', 'Keep'], [true, true]);
				if (!c.hasOwnProperty('week31-1')) {
				}
				else if (c['week31-1'] === '1') {
					generateLine(page, 'C');
					s = offsetMood(s, 'C');
					s = offsetMisc(s, {'R': -1200});
				}
			}
			else if (!readFlag(s, 'Advisor') && readOrFlags(s, ['Outsiders', 'Appropriations'])) {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
		}
		else if (readFlag(s, 'Secrets') && !readFlag(s, 'Divided')) {
			generateLine(page, 'A Surprise:');
			if (readFlag(s, 'Ambition')) {
				generateSpecial(page, 'Interpersonal Diplomacy', 'unlock');
				s = addFlag(s, 'Divorcee');
			}
			else if (readSkill(s, 'cipher') >= 30) {
				generateSpecial(page, 'Better Left Unsaid', 'unlock');
				s = addFlag(s, 'Edification');
			}
		}
		return [s, page];
	},
	// 32
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Avarice');
		generateOptions(page, c, 32, 1, ['Status', 'Employment', 'Purse'], [true, true, readMisc(s, 'G') >= 100])
		if (!c.hasOwnProperty('week32-1')) {
		}
		else if (c['week32-1'] === '2') {
			s = offsetMisc(s, {'R': 400});
		}
		else if (c['week32-1'] === '3') {
			s = offsetMisc(s, {'G': 100});
		}
		if (readAndNotFlags(s, ['Accusation', 'Instigation', 'Minister'])) {
			const divine = readSkill(s, 'divinate');
			if (divine < 70 && readSkill(s, 'decorate') >= 50) {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			const ign = divine >= 70 || readSkill(s, 'court') >= 80 || readSkill(s, 'product') + readSkill(s, 'trade') >= 60;
			if (readSkill(s, 'dogs', true) >= 50 || ign || readSkill(s, 'composure') >= 60) {
				generateOptions(page, c, 32, 2, ['Eat', 'Save', 'Test'], [true, true, ign && readSubgroup(s, 'intrigue') >= 100]);
				if (!c.hasOwnProperty('week32-2')) {
				}
				else if (c['week32-2'] === '2') {
					s = addFlag(s, 'Patience');
				}
				else if (c['week32-2'] === '3') {
					s = addFlag(s, 'Suspicion');
				}
			}
			if (readAndNotFlags(s, ['Patience', 'Suspicion'])) {
				generateLine(page, 'D');
				s = offsetMood(s, 'D');
				if (readSkill(s, 'poison') < 70) {
					generateSpecial(page, 'Been Poisoned', 'death');
				}
			}
			else if (readFlag(s, 'Suspicion')) {
				if (readSubgroup(s, 'medicine') >= 100) {
					generateLine(page, 'A');
					s = offsetMood(s, 'A');
					s = addFlag(s, 'Tainted');
				}
				else if (readFlag(s, 'Advisor')) {}
				else if (readMisc(s, 'K') >= 5) {
					s = addFlag(s, 'Research');
					if (readSubgroup(s, 'animal') < 10) {
						generateSpecial(page, 'An Ex Chicken', 'unlock');
					}
				}
				else {
					generateLine(page, 'D');
					s = offsetMood(s, 'D');
					s = addFlag(s, 'Frustration');
				}
			}
		}
		return [s, page];
	},
	// 33
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Tournament');
		generateOptions(page, c, 33, 1, ['Horse', 'Joust', 'Fencing', 'Archery', 'Music', 'Falcons', 'None'], [true, true, true, true, true, true, true]);
		if (!c.hasOwnProperty('week33-1')) {
		}
		else if (c['week33-1'] === '1') {
			if (readSkill(s, 'horses') >= 50 || readSkill(s, 'composure') + readSkill(s, 'elegance') >= 60) {
				s = offsetMisc(s, {'Ca': 10});
			}
			else {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
				s = offsetMisc(s, {'Ca': -10});
			}
		}
		else if (c['week33-1'] === '2') {
			s = addFlag(s, 'Exhaustion');
			const horse = readSkill(s, 'horses');
			const pole = readSkill(s, 'polearms');
			if (horse >= 50 && pole >= 50) {
				if (horse + pole >= 160) {
					s = offsetMisc(s, {'Ca': 15});
				}
			}
			else {
				s = offsetMisc(s, {'Ca': -10});
			}
		}
		else if (c['week33-1'] === '3') {
			s = addFlag(s, 'Exhaustion');
			const sword = readSkill(s, 'swords');
			if (sword >= 80) {
				s = offsetMisc(s, {'Ca': 15});
			}
			else if (sword < 30) {
				s = offsetMisc(s, {'Ca': -10});
			}
		}
		else if (c['week33-1'] === '4' && readSkill(s, 'archery') >= 100) {
			s = offsetMisc(s, {'Ca': 10});
		}
		else if (c['week33-1'] === '5') {
			const voice = readSkill(s, 'voice');
			if (voice >= 100 && readSkill(s, 'instrument') >= 90) {
				s = offsetMisc(s, {'Ca': 15});
				s = addFlag(s, 'Aria');
			}
			else if (voice >= 100) {
				s = offsetMisc(s, {'Ca': 10});
			}
			else if (voice < 50 && readSkill(s, 'public') < 40) {
				s = offsetMisc(s, {'Ca': -5});
			}
			else if (voice < 50) {
				s = offsetMisc(s, {'Ca': -10});
			}
		}
		else if (c['week33-1'] === '6') {
			if (readSkill(s, 'falcons')) {
				s = offsetMisc(s, {'Na': 10});
			}
			else {
				generateLine(page, 'DP');
				s = offsetMood(s, 'DP');
			}
		}
		else if (c['week33-1'] === '7') {
			generateLine(page, 'D');
			s = offsetMood(s, 'D');
			s = offsetMisc(s, {'Ca': -10});
			s = addFlag(s, 'Observer');
		}
		if (!readFlag(s, 'Observer') && (readFlag(s, 'Confidence') || (readFlag(s, 'Divided') && !readFlag(s, 'United')) || readAndNotFlags(s, ['Divided', 'Forest', 'Tattle', 'Horrify']))) {
			generateLine(page, 'For Honor');
			s = addFlag(s, 'Duelist');
			generateSpecial(page, 'A Gauntlet Thrown', 'unlock');
			const wield = readSkill(s, 'wield');
			generateOptions(page, c, 33, 2, ['Accept', 'Refuse', 'Magic'], [true, true, wield >= 30]);
			if (!c.hasOwnProperty('week33-2')) {
			}
			else if (c['week33-2'] === '1') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				generateOptions(page, c, 33, 3, ['Swords', 'Staves'], [true, true]);
				if (!c.hasOwnProperty('week33-3')) {
				}
				else if (c['week33-3'] === '1') {
					if ((readFlag(s, 'Exhaustion') && readSubgroup(s, 'athletics') < 100) || readSkill(s, 'swords') < 90) {
						generateSpecial(page, 'Gotten too Close to a Sword', 'death');
					}
					s = addFlag(s, 'Proxied');
				}
				else if (c['week33-3'] === '2') {
					const pole = readSkill(s, 'polearms');
					const pofl = pole + readSkill(s, 'flexible');
					const prpu = readSkill(s, 'presence') + readSkill(s, 'public');
					if ((readFlag(s, 'Exhaustion') && readSubgroup(s, 'athletics') < 100) || pole < 50 || (pofl < 100 ||  prpu <= 60)) {
						generateSpecial(page, 'Cracked your Skull', 'death');
					}
					else if (pofl < 100) {
						generateLine(page, 'F');
						s = offsetMood(s, 'F');
						s = offsetMisc(s, {'Ca': -10, 'Na': -10});
					}
					else {
						generateOptions(page, c, 33, 4, ['Hit', 'Restraint'], [true, true]);
						if (!c.hasOwnProperty('week33-4')) {
						}
						else if (c['week33-4'] === '1') {
							generateLine(page, 'A');
							s = offsetMood(s, 'A');
							s = addFlag(s, 'Proxied');
						}
						else if (c['week33-4'] === '2') {
							if (prpu > 60) {
								s = offsetMisc(s, {'Ca': 10, 'Na': 10});
								s = addFlag(s, 'Honored');
							}
							else {
								generateLine(page, 'D');
								s = offsetMood(s, 'D');
								s = addFlag(s, 'Suffer');
							}
						}
					}
				}
			}
			else if (c['week33-2'] === '2') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Objection');
				if (readSkill(s, 'reflexes') + readSkill(s, 'running') >= 80) {
					s = offsetMisc(s, {'Ca': -10});
				}
				else if (readSkill(s, 'falcons') < 80) {
					generateSpecial(page, 'Gotten too Close to a Sword', 'death');
				}
			}
			else if (c['week33-2'] === '3') {
				if (wield < 60) {
					generateSpecial(page, 'Gotten too Close to a Sword', 'death');
				}
				else {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					s = offsetMisc(s, {'K': 3, 'Ca': -20, 'Na': -20});
					s = addFlag(s, 'Proxied');
				}
			}
		}
		if (readFlag(s, 'Patience')) {
			generateLine(page, 'Ongoing Intrigues');
			if (readMisc(s, 'K') >= 5) {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
			}
		}
		else if (readOrFlags(s, ['Tainted', 'Research'])) {
			generateLine(page, 'Ongoing Intrigues');
			if (readFlag(s, 'Research')) {
				s = offsetMisc(s, {'K': 3, 'Ca': -5});
			}
			generateOptions(page, c, 33, 5, ['Guards', 'Supplier', 'Wait'], [true, true, true]);
			if (!c.hasOwnProperty('week33-5')) {
			}
			else if (c['week33-5'] === '1') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'R': -50});
			}
			else if (c['week33-5'] === '2') {
				s = offsetMisc(s, {'G': -100});
			}
		}
		return [s, page];
	},
	// 34
	(s, c) => {
		const page = new DocumentFragment();
		if (readAndNotFlags(s, ['Accusation', 'Instigation', 'Minister', 'Frustration']) && readOrFlags(s, ['Agent', 'Conspirators', 'Peasantry'])) {
			if (readFlag(s, 'Agent') && !readFlag(s, 'Frustration')) {}
			else if (readFlag(s, 'Peasantry') && readMisc(s, 'Ca') <= 30) {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
		}
		generateLine(page, 'Invasion');
		if (!readFlag(s, 'Appropriations')) {
			generateLine(page, 'F');
			s = offsetMood(s, 'F');
		}
		const g = readMisc(s, 'G');
		if (g > 0) {
			generateOptions(page, c, 34, 1, ['Agree', 'Refuse'], [true, true]);
			if (!c.hasOwnProperty('week34-1')) {
			}
			else if (c['week34-1'] === '1') {
				if (g > 2000) {
					generateLine(page, '-2000G');
					s = offsetMisc(s, {'G': -2000, 'R': 1000});
				}
				else {
					const r = Math.floor(g * 0.5);
					generateLine(page, -2 * r + 'G');
					s = offsetMisc(s, {'G': -2 * r, 'R': r});
				}
			}
		}
		generateOptions(page, c, 34, 2, ['Lead', 'Stay'], [true, true]);
		if (!c.hasOwnProperty('week34-2')) {
		}
		else if (c['week34-2'] === '1') {
			if (readOrFlags(s, ['Armistice', 'Advisor']) && readSkill(s, 'naval') + readSkill(s, 'swimming') > 100 || readAndNotFlags(s, ['Armistice', 'Advisor'])) {
				s = addFlag(s, 'Leadership');
			}
		}
		if (readAndFlags(s, ['Lumen', 'Leadership']) && readOrFlags(s, ['Assistant', 'Sensor', 'Minister'])) {
			generateOptions(page, c, 34, 3, ['Agree', 'Refuse'], [true, true]);
			if (!c.hasOwnProperty('week34-3')) {
			}
			else if (c['week34-3'] === '1') {
				s = addFlag(s, 'Pledge');
				if (readAndFlags(s, ['Assistant', 'Minister'])) {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
				}
				else if (readFlag(s, 'Assistant')) {
					generateLine(page, '-W-Y');
					s = offsetMood(s, '-W-Y');
				}
				else if (readOrFlags(s, ['Sensor', 'Minister'])) {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					if (readAndFlags(s, ['Sensor', 'Minister'])) {
						s = addFlag(s, 'Vier');
					}
				}
			}
			else if (c['week34-3'] === '2') {
				if (readAndFlags(s, ['Assistant', 'Minister'])) {
					generateLine(page, 'F');
					s = offsetMood(s, 'F');
				}
				else if (readFlag(s, 'Assistant')) {
					generateLine(page, 'D');
					s = offsetMood(s, 'D');
				}
				else if (readOrFlags(s, ['Sensor', 'Minister'])) {
					generateLine(page, 'F');
					s = offsetMood(s, 'F');
				}
			}
		}
		return [s, page];
	},
	// 35
	(s, c) => {
		const page = new DocumentFragment();
		s = addFlag(s, 'War');
		const wield = readSkill(s, 'wield');
		if (readFlag(s, 'Pledge')) {
			generateLine(page, 'Last Chance:');
			const lumen = readSubgroup(s, 'lumen');
			if (wield >= 100) {
				if ((readFlag(s, 'Vier') && lumen >= 200) || lumen >= 300) {
					s = addFlag(s, 'Turn');
					s = addFlag(s, 'Prestige');
				}
				else if ((readFlag(s, 'Vier') && lumen >= 120) || lumen >= 200) {
					s = addFlag(s, 'Turn');
					s = addFlag(s, 'Resisted');
				}
				else {
					s = addFlag(s, 'Resisted');
				}
				if (readFlag(s, 'Prestige')) {
					generateSpecial(page, 'Plunged into the Depths', 'unlock');
				}
				else if (!readFlag(s, 'Turn')) {
					generateSpecial(page, 'Blown Yourself Up', 'death');
				}
			}
			else {
				s = addFlag(s, 'Outranged');
				if (readFlag(s, 'Vier') && lumen >= 200) {
					generateSpecial(page, 'Drowned At Sea', 'death');
				}
				else if (lumen < 200 && !readFlag(s, 'Vier') || lumen < 120) {
					generateSpecial(page, 'Blown Yourself Up', 'death');
				}
				else {
					s = addFlag(s, 'Turn');
				}
			}
		}
		const pre = readFlag(s, 'Prestige');
		if (!pre && readFlag(s, 'Molehill') && readSkill(s, 'court') >= 60) {
			generateSpecial(page, 'A Military Alliance', 'unlock');
			s = offsetMisc(s, {'Ca': -10, 'R': 2000});
		}
		if (!pre) {
			generateLine(page, 'At Sea:');
			if (readFlag(s, 'Mariners')) {
				s = offsetMisc(s, {'R': 3000});
			}
			const naval = readSkill(s, 'naval');
			const lead = readFlag(s, 'Leadership');
			const climbBon = lead && readSkill(s, 'climbing') >= 60;
			let nb = (naval <= 0) ? -0.25 : 0;
			if (naval >= 50) {
				nb = 0.001 * (naval - 50) + ((climbBon) ? 0.0001 * naval : 0);
			}
			if (naval >= 100) {
				nb += 0.0005 * readSkill(s, 'strategy');
			}
			const logs = readSkill(s, 'logs');
			if (logs >= 90) {
				nb += 0.0005 * logs;
			}
			const wield = readSkill(s, 'wield');
			if (!lead) {
				nb *= 0.5;
			}
			else if (wield >= 60) {
				nb += 0.05 + ((climbBon) ? wield / 3333 : 0);
			}
			const shan = 18000 * ((readFlag(s, 'Turn')) ? 0.5 : 1);
			if (readMisc(s, 'R') * (1 + nb) >= shan) {
				generateLine(page, '3C', false);
				generateSpecial(page, 'Victory At Sea', 'unlock');
				s = offsetMood(s, '3C');
				s = offsetMisc(s, {'Ca': 20, 'Na': 20});
				s = addFlag(s, 'Victory');
			}
			else if (lead) {
				if (naval + readSkill(s, 'strategy') < 150) {
					generateLine(page, '-5CF');
					s = offsetMood(s, '-5CF');
					const swim = readSkill(s, 'swimming');
					if (swim >= 100) {
						const w = (readMoodAxis(s, 'W') < 0) ? '-5Y' : '-W';
						generateLine(page, w);
						s = offsetMood(s, w);
					}
					else if (swim >= 80) {
						generateLine(page, '5D');
						s = offsetMood(s, '5D');
					}
					else if (swim < 50 || (readSkill(s, 'composure') < 70 && readSkill(s, 'meditate') < 70)) {
						generateSpecial(page, 'Drowned At Sea', 'death');
					}
					else {
						generateLine(page, 'I5F');
						s = offsetMood(s, 'I5F');
					}
				}
				else {
					s = offsetMisc(s, {'Ca': -5});
					s = addFlag(s, 'Retreat');
				}
			}
		}
		return [s, page];
	},
	// 36
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Diplomacy');
		if (readFlag(s, 'Prestige') || readAndFlags(s, ['Pledge', 'Victory'])) {
			generateLine(page, 'F');
			s = offsetMood(s, 'F');
			s = offsetMisc(s, {'Ca': -10});
		}
		else if (readFlag(s, 'Victory')) {
			generateOptions(page, c, 36, 1, ['Ransom', 'Ransom/Conscript', 'Ransom/Execute', 'Execute All'], [readSkill(s, 'world') >= 80, true, true, true]);
			if (!c.hasOwnProperty('week36-1')) {
			}
			else if (c['week36-1'] === '1') {
				generateLine(page, '1000G', false);
				generateSpecial(page, 'A Hostage to Fortune', 'unlock');
				s = offsetMisc(s, {'G': 1000});
			}
			else if (c['week36-1'] === '2') {
				generateLine(page, '700G', false);
				generateSpecial(page, 'A Hostage to Fortune', 'unlock');
				s = offsetMisc(s, {'Ca': -10, 'G': 700, 'R': 890});
			}
			else if (c['week36-1'] === '3') {
				generateLine(page, '700G', false);
				generateSpecial(page, 'A Hostage to Fortune', 'unlock');
				generateSpecial(page, 'Off with Their Heads', 'unlock');
				s = offsetMisc(s, {'K': 3, 'G': 700});
				s = addFlag(s, 'Proletariat');
			}
			else if (c['week36-1'] === '4') {
				generateLine(page, 'A', false);
				generateSpecial(page, 'Off with Their Heads', 'unlock');
				s = offsetMood(s, 'A');
				s = offsetMisc(s, {'K': 3});
				s = addFlag(s, 'Proletariat');
				s = addFlag(s, 'Charity');
			}
		}
		else {
			if (readFlag(s, 'Opportunist') && readAndNotFlags(s, ['Contender', 'Supplanted'])) {
				generateOptions(page, c, 36, 2, ['Accept', 'Reject'], [true, true]);
				if (!c.hasOwnProperty('week36-2')) {
				}
				else if (c['week36-2'] === '1') {
					generateSpecial(page, 'Game Over', 'loss', false);
					generateLine(page, 'Window 8');
				}
			}
			const comp = readSkill(s, 'composure');
			if (comp < 40 && readSkill(s, 'court') < 60) {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
			const mcon = readSkill(s, 'forint') < 90 && (!readFlag(s, 'Opportunist') || readOrFlags(s, ['Supplanted', 'Contender'])) && (!readFlag(s, 'Contender') || readFlag(s, 'Supplanted')) && !readFlag(s, 'Ward');
			const ocon = readOrFlags(s, ['Prismatics', 'Pledge']) || (readFlag(s, 'Lumen') && readSkill(s, 'lore') >= 90);
			const scon = readSkill(s, 'forint') >= 90;
			generateOptions(page, c, 36, 3, ['Duel', 'Marriage', 'Offer', 'Sing', 'Refuse'], [true, mcon && !readFlag(s, 'Fiancee'), ocon && !readFlag(s, 'Supplicant'), scon && !readFlag(s, 'Audience'), readFlag(s, 'Lumen')]);
			const c36a = c.hasOwnProperty('week36-3');
			const c36b = c.hasOwnProperty('week36-4');
			const c36c = c.hasOwnProperty('week36-5');
			if (!c36a) {}
			else if (c['week36-3'] === '2') {
				s = addFlag(s, 'Fiancee');
			}
			else if (c['week36-3'] === '3') {
				s = addFlag(s, 'Supplicant');
				if (readMisc(s, 'K') >= 10) {
					generateOptions(page, c, 36, 6, ['Accept', 'Refuse'], [true, true]);
					if (!c.hasOwnProperty('week36-6')) {
					}
					else if (c['week36-6'] == '1') {
						generateSpecial(page, 'To Serve Evil', 'unlock', false);
						generateSpecial(page, 'Game Over', 'loss', false);
						generateLine(page, 'Window 16');
					}
				}
			}
			else if (c['week36-3'] === '4') {
				s = addFlag(s, 'Audience');
				if (readSkill(s, 'instrument') + readSkill(s, 'voice') >= 100 && readSkill(s, 'public') >= 70 && readSkill(s, 'presence') >= 70) {
					generateSpecial(page, 'Angel of Music', 'unlock');
					s = offsetMisc(s, {'Ca': 15, 'Na': 15});
					s = addFlag(s, 'Duet');
				}
			}
			if (c36a && ['2', '3', '4'].includes(c['week36-3']) && !readFlag(s, 'Duet')) {
				generateOptions(page, c, 36, 4, ['Duel', 'Marriage', 'Offer', 'Sing', 'Refuse'], [true, mcon && !readFlag(s, 'Fiancee'), ocon && !readFlag(s, 'Supplicant'), scon && !readFlag(s, 'Audience')]);
				if (!c36b) {}
				else if (c['week36-4'] === '2') {
					s = addFlag(s, 'Fiancee');
				}
				else if (c['week36-4'] === '3') {
					s = addFlag(s, 'Supplicant');
					if (readMisc(s, 'K') >= 10) {
						generateOptions(page, c, 36, 7, ['Accept', 'Refuse'], [true, true]);
						if (!c.hasOwnProperty('week36-7')) {
						}
						else if (c['week36-6'] == '1') {
							generateSpecial(page, 'To Serve Evil', 'unlock', false);
							generateSpecial(page, 'Game Over', 'loss', false);
							generateLine(page, 'Window 16');
						}
					}
				}
				else if (c['week36-4'] === '4') {
					s = addFlag(s, 'Audience');
					if (readSkill(s, 'instrument') + readSkill(s, 'voice') >= 100 && readSkill(s, 'public') >= 70 && readSkill(s, 'presence') >= 70) {
						generateSpecial(page, 'Angel of Music', 'unlock');
						s = offsetMisc(s, {'Ca': 15, 'Na': 15});
						s = addFlag(s, 'Duet');
					}
				}
			}
			if (c36b && ['2', '3', '4'].includes(c['week36-4']) && !readFlag(s, 'Duet')) {
				generateOptions(page, c, 36, 5, ['Duel', 'Marriage', 'Offer', 'Sing', 'Refuse'], [true, mcon && !readFlag(s, 'Fiancee'), ocon && !readFlag(s, 'Supplicant'), scon && !readFlag(s, 'Audience')]);
			}
			if (c36a && c['week36-3'] === '1' || c36b && c['week36-4'] === '1' || c36c && c['week36-5'] === '1') {
				s = addFlag(s, 'Encircled');
				if (readFlag(s, 'Lumen')) {
					const resist = readSkill(s, 'resist');
					const sense = readSkill(s, 'sense');
					const med = readSkill(s, 'meditate');
					const wield = readSkill(s, 'wield');
					if (resist < 60) {
						generateSpecial(page, 'Been Blasted By Magic', 'death');
					}
					else if (sense < 60 && (resist < 100 || med < 30)) {
						generateSpecial(page, 'Had your Life Drained', 'death');
					}
					else if (sense < 60 && resist >= 100 && med >= 30) {
						generateLine(page, 'W');
						s = offsetMood(s, 'W');
					}
					if (wield >= 50) {
						generateOptions(page, c, 36, 8, ['Sword', 'Dazzle'], [true, true]);
						if (c.hasOwnProperty('week36-8') && c['week36-8'] === '1') {
							s = addFlag(s, 'Unsheathed');
						}
					}
					if ((readFlag(s, 'Unsheathed') && readSkill(s, 'reflexes') + readSkill(s, 'swords') < 100) || !readFlag(s, 'Unsheathed') && (wield < 80 || readSkill(s, 'decorate') < 70)) {
						generateSpecial(page, 'Been Blasted By Magic', 'death');
					}
				}
				else if (readFlag(s, 'Artifact')) {
					generateLine(page, '8F');
					s = offsetMood(s, '8F');
					s = addFlag(s, 'Mirrored');
				}
				else {
					generateLine(page, 'A10D', false);
					generateSpecial(page, 'Facing Facts', 'unlock');
					s = offsetMood(s, 'A10D');
					s = addFlag(s, 'Regicide');
					if (comp < 70) {
						generateSpecial(page, 'Been Blasted By Magic', 'death');
					}
					generateOptions(page, c, 36, 9, ['Accept', 'Refuse', 'Rules'], [true, true, comp >= 100]);
					if (!c.hasOwnProperty('week36-9')) {
					}
					else if (c['week36-9'] === '1') {
						generateLine(page, '2Y');
						s = offsetMood(s, '2Y');
					}
					else if (c['week36-9'] === '2') {
						generateSpecial(page, 'Been Blasted By Magic', 'death');
					}
					else if (c['week36-9'] === '3') {
						generateLine(page, '2W');
						s = offsetMood(s, '2W');
					}
				}
			}
			else if (c36a && c['week36-3'] === '5' || c36b && c['week36-4'] === '5' || c36c && c['week36-5'] === '5') {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
				s = addFlag(s, 'Unyielding');
			}
		}
		return [s, page];
	},
	// 37
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Loose Ends');
		if (readFlag(s, 'Victory')) {
			generateLine(page, '2C');
			s = offsetMood(s, '2C');
		}
		else if (readFlag(s, 'Prestige')) {}
		else if (readFlag(s, 'Regicide')) {
			if (!readFlag(s, 'Musician') && (!readFlag(s, 'Agent') || (!readFlag(s, 'Frustration') && readOrFlags(s, ['Accusation', 'Instigation', 'Minister'])))) {
				if (readFlag(s, 'Peasantry')) {
					s = offsetMisc(s, {'Ca': -5});
				}
				else {
					s = offsetMisc(s, {'Ca': -10});
				}
			}
		}
		else if (readFlag(s, 'Duet')) {
			generateLine(page, 'C');
			s = offsetMood(s, 'C');
		}
		else if (readFlag(s, 'Encircled')) {
			generateLine(page, '-766G', false);
			generateSpecial(page, 'A Little Backup', 'unlock');
			if (!readFlag(s, 'Peasantry') && (!readFlag(s, 'Opportunist') || readOrFlags(s, ['Contender', 'Supplanted']))) {
				s = offsetMisc(s, {'Ca': -10});
			}
		}
		if (readOrFlags(s, ['Victory', 'Prestige', 'Duet', 'Encircled']) && readFlag(s, 'Agent') && readAndNotFlags(s, ['Accusation', 'Instigation', 'Minister', 'Frustration'])) {
			if (readFlag(s, 'Magician') && !readFlag(s, 'Familiarity')) {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
			}
			generateLine(page, 'D');
			s = offsetMood(s, 'D');
			s = addFlag(s, 'Backtracked');
			generateOptions(page, c, 37, 1, ['Accept', 'Reject', 'Ask'], [true, true, readFlag(s, 'Kin')]);
			if (!c.hasOwnProperty('week37-1')) {}
			else if (c['week37-1'] === '2') {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = addFlag(s, 'Deceit');
				generateOptions(page, c, 37, 3, ['Imprison', 'Execute'], [true, true]);
				if (!c.hasOwnProperty('week37-3')) {
				}
				else if (c['week37-3'] === '2') {
					generateSpecial(page, 'Off with Their Heads', 'unlock')
					s = offsetMisc(s, {'K': 3});
				}
			}
			else if (c['week37-1'] === '1' || c['week37-1'] === '3' ) {
				generateOptions(page, c, 37, 2, ['Execute Her', 'Execute Both', 'Execute and Banish', 'Execute All', 'Banish All'], [true, readAndNotFlags(s, ['Machination', 'Scapegoat']), true, true, true]);
				if (!c.hasOwnProperty('week37-2')) {
				}
				else if (c['week37-2'] === '1') {
					generateSpecial(page, 'Off with Their Heads', 'unlock')
					s = addFlag(s, 'Rebel');
				}
				else if (c['week37-2'] === '2') {
					generateSpecial(page, 'Off with Their Heads', 'unlock')
					s = addFlag(s, 'Rebel');
				}
				else if (c['week37-2'] === '3') {
					generateSpecial(page, 'Off with Their Heads', 'unlock')
					s = addFlag(s, 'Rebel');
				}
				else if (c['week37-2'] === '4') {
					generateSpecial(page, 'Off with Their Heads', 'unlock')
					s = addFlag(s, 'Rebellion');
				}
			}
		}
		else if (readAndFlags(s, ['Regicide', 'Agent']) && readAndNotFlags(s, ['Accusation', 'Instigation', 'Minister', 'Frustration'])) {
			if (determineMood(s) !== 'D') {
				generateOptions(page, c, 37, 4, ['Execute', 'Wait'], [true, true]);
				if (!c.hasOwnProperty('week37-4')) {
				}
				else if (c['week37-4'] === '1') {
					s = offsetMisc(s, {'Ca': -15, 'Na': -15});
					s = addFlag(s, 'Re-Rebel');
				}
				else if (c['week37-4'] === '2') {
					generateLine(page, 'D2Y');
					s = offsetMood(s, 'D2Y');
				}
			}
		}
		if (readFlag(s, 'Prestige')) {
			generateOptions(page, c, 37, 5, ['Sacrifice', 'Charlotte', 'Seal'], [true, readFlag(s, 'Backtracked') || (readFlag(s, 'Familiarity') && readMisc(s, 'K') >= 10), determineMood(s) !== 'D']);
			if (!c.hasOwnProperty('week37-5')) {
			}
			else if (c['week37-5'] === '1') {
				generateSpecial(page, 'Fallen Victim to Monsters', 'death');
			}
			else if (c['week37-5'] === '2') {
				generateSpecial(page, 'The Needs Of The Many', 'unlock');
				s = addFlag(s, 'Oblation');
				if (readAndNotFlags(s, ['Backtracked', 'Machination', 'Scapegoat'])) {
					s = offsetMisc(s, {'K': 5});
				}
			}
			else if (c['week37-5'] === '3') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Behemoth');
			}
		}
		return [s, page];
	},
	// 38
	(s, c) => {
		const page = new DocumentFragment();
		if (readFlag(s, 'Oblation') && readAndNotFlags(s, ['Rebel', 'Re-Rebel', 'Accusation', 'Instigation'])) {
			generateLine(page, 'Anger');
			generateSpecial(page, 'Had your Life Drained', 'death');
		}
		const ca = readMisc(s, 'Ca');
		if (ca < -45) {
			const peas = readFlag(s, 'Peasantry');
			if (!peas && !readFlag(s, 'Regicide') && readOrFlags(s, ['Vacancy', 'Re-Rebel'])) {
				generateLine(page, 'P');
				s = offsetMood(s, 'P');
			}
			else if (peas) {
				const herb = readSkill(s, 'herbs');
				generateOptions(page, c, 38, 1, ['Concert', 'Medicine', 'Speech'], [!readFlag(s, 'Deceit') && readOrFlags(s, ['Musician', 'Agent']), herb >= 10, true]);
				if (!c.hasOwnProperty('week38-1')) {}
				else if (c['week38-1'] === '1') {
					s = offsetMisc(s, {'Ca': 10});
					s = addFlag(s, 'Loyalty');
				}
				else if (c['week38-1'] === '2') {
					if (herb >= 80 && readSkill(s, 'divinate') >= 30) {
						generateSpecial(page, 'A Divine Omen', 'unlock');
						s = offsetMisc(s, {'Ca': 15});
						s = addFlag(s, 'Loyalty');
					}
					else if (readSkill(s, 'decorate') >= 50 || readSkill(s, 'elegance') >= 50 || herb + readSkill(s, 'battle') > 50) {
						s = offsetMisc(s, {'Ca': 10});
						s = addFlag(s, 'Loyalty');
					}
				}
				else if (c['week38-1'] === '3') {
					const pres = readSkill(s, 'presence');
					if (pres + readSkill(s, 'public') > 100 || pres + readSkill(s, 'elegance') > 100 || pres + readSkill(s, 'decorate') > 100) {
						s = offsetMisc(s, {'Ca': 10});
						s = addFlag(s, 'Loyalty');
					}
				}
			}
		}
		if (readFlag(s, 'Regicide') && readAndNotFlags(s, ['Demons', 'Re-Rebel', 'Accusation', 'Instigation'])) {
			generateLine(page, 'Y');
			s = offsetMood(s, 'Y');
			s = addFlag(s, 'Cousin');
		}
		else if (readFlag(s, 'Minister') && ca >= -45) {
			s = addFlag(s, 'Cousin');
			s = addFlag(s, 'Heritage');
		}
		if (readFlag(s, 'Behemoth')) {
			generateLine(page, '-200G');
			s = offsetMisc(s, {'G': -200});
		}
		generateLine(page, 'Public Feast');
		const g = readMisc(s, 'G');
		if (g < 100) {
			s = offsetMisc(s, {'Ca': -10});
		}
		else {
			generateOptions(page, c, 38, 2, ['Extravagant', 'Respectable', 'Small', 'None'], [g >= 500, g >= 250, g >= 100, true]);
			if (!c.hasOwnProperty('week38-2')) {}
			else if (c['week38-2'] === '1') {
				generateLine(page, '-500G');
				s = offsetMisc(s, {'G': -500});
				if (!readFlag(s, 'Regicide')) {
					s = offsetMisc(s, {'Ca': 15});
				}
			}
			else if (c['week38-2'] === '2') {
				generateLine(page, '-250G');
				s = offsetMisc(s, {'G': -250});
				s = offsetMisc(s, {'Ca': 10});
			}
			else if (c['week38-2'] === '3') {
				generateLine(page, '-100G');
				s = offsetMisc(s, {'G': -100});
				s = offsetMisc(s, {'Ca': 10});
				s = addFlag(s, 'Generosity');
			}
			else if (c['week38-2'] === '4') {
				s = offsetMisc(s, {'Ca': -10});
			}
		}
		return [s, page];
	},
	// 39
	(s, c) => {
		const page = new DocumentFragment();
		generateLine(page, 'Consort');
		if (readMisc(s, 'Ca') <= -45 && !readFlag(s, 'Loyalty')) {
			generateSpecial(page, 'The Will Of The People', 'unlock');
			if (!readFlag(s, 'Lumen')) {
				generateSpecial(page, 'Game Over', 'loss', false);
				generateLine(page, 'Window 8');
			}
			generateOptions(page, c, 39, 1, ['Attack', 'Do Not'], [true, true]);
			if (!c.hasOwnProperty('week39-1')) {}
			else if (c['week39-1'] === '1') {
				if (readSkill(s, 'wield') >= 30) {
					s = offsetMisc(s, {'K': 1, 'Ca': -10, 'Na': -10});
					s = addFlag(s, 'Interrupted');
				}
				else if (readSkill(s, 'presence') >= 100) {
					s = offsetMisc(s, {'Ca': -10});
					s = addFlag(s, 'Interrupted');
				}
				else {
					generateSpecial(page, 'Cracked Your Skull', 'death');
				}
			}
			else if (c['week39-1'] === '2') {
				generateSpecial(page, 'Game Over', 'loss', false);
				generateLine(page, 'Window 8');
			}
		}
		if (!readFlag(s, 'Interrupted')) {
			if (readSkill(s, 'decorate') >= 30) {
				s = offsetMisc(s, {'Ca': 10});
			}
			if (readFlag(s, 'Ward')) {}
			else if (readFlag(s, 'Regicide') && readAndNotFlags(s, ['Rebel', 'Re-Rebel', 'Accusation', 'Instigation']) && ((readFlag(s, 'Opportunist') && readAndNotFlags(s, ['Contender', 'Supplanted'])) || (readFlag(s, 'Contender') && !readFlag(s, 'Supplanted')) || readOrFlags(s, ['Armistice', 'Alliance']))) {
				generateOptions(page, c, 39, 2, ['Soon', 'Wait'], [true, true]);
				if (!c.hasOwnProperty('week39-2')) {}
				else if (c['week39-2'] === '2') {
					s = addFlag(s, 'Postponement');
				}
			}
			else if ((readFlag(s, 'Regicide') && readAndNotFlags(s, ['Rebel', 'Re-Rebel', 'Accusation', 'Instigation'])) || (readFlag(s, 'Opportunist') && readAndNotFlags(s, ['Contender', 'Supplanted'])) || (readFlag(s, 'Contender') && !readFlag(s, 'Supplanted')) || readOrFlags(s, ['Armistice', 'Alliance'])) {
			}
			else {
				if (readFlag(s, 'Sappho') && readAndNotFlags(s, ['Regicide',  'Mirrored', 'Arrangement', 'Gracefulness', 'Quash', 'Troublemaker', 'Molehill'])) {
					s = addFlag(s, 'Matrimony');
				}
				const kiran = readOrFlags(s, ['Prevention', 'Re-Prevention', 'Exiles']) || (readFlag(s, 'Divided') && !readFlag(s, 'United'));
				const presB = readSkill(s, 'presence', true);
				const pubB = readSkill(s, 'public', true);
				const kevan = !readFlag(s, 'Duelist') || readFlag(s, 'Honored') || (readAndNotFlags(s, ['Objection', 'Proxied', 'Suffer']) && (presB + pubB > 60 || (presB + pubB > 50 && ((presB >= 25 && readSkill(s, 'composure') >= 25 && readSkill(s, 'elegance') >= 25) || (pubB >= 25 && readSkill(s, 'court') >= 25 && readSkill(s, 'flattery') >= 25)))));
				const adair = !readFlag(s, 'Lineage') || (readFlag(s, 'Opportunist') && !readFlag(s, 'Contender'));
				const briony = readFlag(s, 'Adventure') && !readFlag(s, 'Abandoned');
				generateOptions(page, c, 39, 3, ['Talarist', 'Banion', 'Kiran', 'Linley', 'Ignatius', 'Kevan', 'Adair', 'Anciet', 'Briony', 'Evrard', 'No One'], [true, !readFlag(s, 'Gracefulness'), kiran, readFlag(s, 'Exuberance'), readFlag(s, 'Divorcee'), kevan, adair, true, briony, readFlag(s, 'Cookies'), true]);
				if (!c.hasOwnProperty('week39-3')) {}
				else if (c['week39-3'] === '1') {
					s = addFlag(s, 'Seized');
				}
				else if (c['week39-3'] === '2') {
					s = addFlag(s, 'Challenger');
				}
				else if (c['week39-3'] === '3') {
					s = addFlag(s, 'Feint');
				}
				else if (c['week39-3'] === '4') {
					s = addFlag(s, 'Earnest');
				}
				else if (c['week39-3'] === '5') {
					s = addFlag(s, 'Bull');
				}
				else if (c['week39-3'] === '6') {
					s = addFlag(s, 'Bear');
				}
				else if (c['week39-3'] === '7') {
					s = addFlag(s, 'Vassal');
				}
				else if (c['week39-3'] === '8') {
					s = addFlag(s, 'Obsession');
				}
				else if (c['week39-3'] === '9') {
					s = addFlag(s, 'Coven');
				}
				else if (c['week39-3'] === '10') {
					s = addFlag(s, 'Sous-Chez');
				}
				else if (c['week39-3'] === '11') {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					s = addFlag(s, 'Bachelorette');
				}
			}
		}
		return [s, page];
	},
	// 40
	(s, c) => {
		const page = new DocumentFragment();
		generateSpecial(page, 'Long Live The Queen', 'unlock')
		generateLine(page, 'Epilogue');
		if (readFlag(s, 'Arrangement')) {
			s = addFlag(s, 'Rosethorn');
		}
		const neverLumen = !readFlag(s, 'Lumen') && (readAndFlags(s, ['Mentored', 'Darkened']) || readFlag(s, 'Mentored') || (readFlag(s, 'Dungeoness') && !readFlag(s, 'Mentor')));
		const quake = readFlag(s, 'Tremors');
		if (neverLumen) {
			generateLine(page, 'Window 2');
		}
		else if (!readFlag(s, 'Lumen')) {
			generateLine(page, 'Window 1');
		}
		else if (quake) {
			generateLine(page, 'Window 6');
			generateLine(page, 'Window 10');
		}
		else if (readFlag(s, 'Generosity') && !readFlag(s, 'Retreat')) {
			s = offsetMisc(s, {'Ca': -15});
		}
		const post = readFlag(s, 'Postponement');
		const engA = readFlag(s, 'Opportunist') && readAndNotFlags(s, ['Contender', 'Supplanted']);
		const engB = readFlag(s, 'Contender') && !readFlag(s, 'Supplanted');
		const engD = readOrFlags(s, ['Armistice', 'Alliance']);
		if (!post) {
			if (engA) {
				s = addFlag(s, 'Ceremony');
				s = addFlag(s, 'Upjumped');
				s = addFlag(s, 'Groomed');
				generateLine(page, 'Window 3');
			}
			else if (engB || engD) {
				s = addFlag(s, 'Ceremony');
				generateLine(page, 'Window 3');
			}
		}
		else if (post && engD && lucille) {
			generateLine(page, 'Window 3');
			s = addFlag(s, 'Ceremony');
			s = addFlag(s, 'Advisement');
		}
		if (readFlag(s, 'Mirrored')) {
			generateLine(page, 'Window 4');	
		}
		else if (quake) {
			generateLine(page, 'Window 3');
		}
		else if (!readFlag(s, 'Regicide')) {
			if (readAndFlags(s, ['Matrimony', 'Challenger']) && !readFlag(s, 'Denoble')) {
				generateLine(page, 'Window 3');
				s = addFlag(s, 'Rosethorn');
			}
			else if (!readFlag(s, 'Snuffed') && readOrFlags(s, ['Opportunist', 'Contender', 'Arrangement'])) {
				generateLine(page, 'Window 3');
			}
			else {
				generateLine(page, 'Window 4');
			}
		}
		else {
			if (readFlag(s, 'Re-Rebel')) {
				if (readMisc(s, 'Na') < -40) {
					generateLine(page, 'Window 7');
				}
				else {
					generateSpecial(page, 'Rebellious Province', 'unlock', false);
					generateLine(page, 'Window 5');
					generateLine(page, 'Window 6');
				}
			}
			else if (readSkill(s, 'internal') >= 20 && readAndNotFlags(s, ['Machination', 'Scapegoat', 'Rebel', 'Accusation', 'Instigation'])) {
				s = addFlag(s, 'Appeasement');
				generateLine(page, 'Window 5');
				generateLine(page, 'Window 6');		
			}
			else {
				generateLine(page, 'Window 5');
				generateLine(page, 'Window 9');
			}
		}
		if (readAndFlags(s, ['Minister', 'Encircled'])) {
			generateSpecial(page, 'Shared Power Increased', 'unlock', false);
			generateLine(page, 'Window 1');
		}
		else if (readAndFlags(s, ['Minister', 'Corruption'])) {
			generateLine(page, 'Window 10');
		}
		if (readAndNotFlags(s, ['Regicide', 'Deceit']) && readFlag(s, 'Backtracked') && readOrFlags(s, ['Rebel', 'Rebellion'])) {
			generateLine(page, 'Window 10');
			if (readFlag(s, 'Rebellion')) {
				generateSpecial(page, 'Rebellious Province', 'unlock', false);
				generateLine(page, 'Window 6');
			}
		}
		else if (readFlag(s, 'Backtracked') && !readFlag(s, 'Deceit')) {
			generateLine(page, 'Window 10');	
		}
		const lucille = readAndNotFlags(s, ['Rebel', 'Re-Rebel', 'Accusation', 'Instigation']);
		if (readFlag(s, 'Regicide') && lucille && readAndNotFlags(s, ['Advisement', 'Appeasement'])) {
			generateLine(page, 'Window 12');
			s = addFlag(s, 'Fruitless');
		}

		if (readOrFlags(s, ['Accusation', 'Instigation']) && !readFlag(s, 'Oblation')) {
			generateLine(page, 'Window 9');
		}
		const briony = readAndNotFlags(s, ['Exiles', 'Confidence', 'Abandoned']) && readOrFlags(s, ['Gossip', 'Divides']) && (!readFlag(s, 'Gossip') || readOrFlags(s, ['Forest', 'Tattle', 'Horrify']));
		if (readFlag(s, 'Encircled') && readAndNotFlags(s, ['Demons', 'Consequences', 'Regicide', 'Pledge']) && readOrNotFlags(s, ['Interrupted', 'Riotous']) && (!readFlag(s, 'Backtracked') || readOrFlags(s, ['Deceit', 'Rebel', 'Rebellion', 'Machination', 'Scapegoat']))) {
			generateLine(page, 'Window 13');
			if (briony) {
				generateLine(page, 'Window 14');
			}
		}
		else if (readAndFlags(s, ['Lumen', 'Victory']) && readAndNotFlags(s, ['Demons', 'Jailbreak', 'Pledge']) && readOrFlags(s, ['Propagande', 'Powerful']) && (!readFlag(s, 'Backtracked') || readOrFlags(s, ['Deceit', 'Rebel', 'Rebellion']))) {
			generateLine(page, 'Window 13');
			if (!readFlag(s, 'Ambition') && briony) {
				generateLine(page, 'Window 14');
			}
		}
		else if (readFlag(s, 'Behemoth')) {
			generateLine(page, 'Window 17');
		}
		else if (readFlag(s, 'Oblation')) {
			generateLine(page, 'Window 10');
			generateLine(page, 'Window 17');
		}
		else if (neverLumen) {
			generateLine(page, 'Window 10');
		}
		else if (readAndNotFlags(s, ['Ambition', 'Minister'])) {
			generateLine(page, 'Window 15');
			generateLine(page, 'Window 18');
		}
		else if (readAndFlags(s, ['Minister', 'Encircled'])) {
			generateLine(page, 'Window 6');
			generateLine(page, 'Window 18');
		}
		if (readFlag(s, 'Duet')) {
			generateLine(page, 'Window 19');
		}
		else if (readFlag(s, 'Victory')) {
			generateLine(page, 'Window 20');
		}
		else if (readFlag(s, 'Regicide')) {
			generateLine(page, 'Window 20');
			if (readSkill(s, 'forint') < 60 && (readSkill(s, 'world') >= 40 || readSkill(s, 'lore') >= 30) && neverLumen) {
				generateLine(page, 'Window 19');
			}
		}
		else if (readOrFlags(s, ['Encircled', 'Tremors'])) {
			generateLine(page, 'Window 20');
		}
		if (readAndFlags(s, ['Bounty', 'Wanted', 'Portrait'])) {
			generateLine(page, 'Window 20');
		}
		const cerm = readFlag(s, 'Ceremony');
		if (readFlag(s, 'Spartacus') && (!engA || cerm) && readAndNotFlags(s, ['Upjumped', 'Favoritism']) && (!readFlag(s, 'Seized') || cerm)) {
			generateLine(page, 'Window 20');
		}
		else if (readFlag(s, 'Estate')) {
			generateLine(page, 'Window 3');
			s = addFlag(s, 'Groomed');
		}
		else if (readFlag(s, 'Succession')) {
			if (cerm || !readFlag(s, 'Seized')) {
				generateLine(page, 'Window 20');	
			}
			else {
				generateLine(page, 'Window 3');
				s = addFlag(s, 'Ceremony');
				s = addFlag(s, 'Upjumped');
				s = addFlag(s, 'Groomed');	
				if (readFlag(s, 'Lineage') && !readFlag(s, 'Favoritism')) {
					generateLine(page, 'Window 9');			
				}
			}
		}
		else if (readAndFlags(s, ['Suitor', 'Supplanted'])) {
			generateLine(page, 'Window 20');
		}
		if (readFlag(s, 'Unconsummate')) {
			generateLine(page, 'Window 9');
		}
		else if (readFlag(s, 'Heartbroken')) {
			generateLine(page, 'Window 9');
			if (!readFlag(s, 'Tactful')) {
				generateLine(page, 'Window 3');
			}
		}
		if (post && engB) {
			if (readFlag(s, 'Playful')) {
				generateLine(page, 'Window 3');
				s = addFlag(s, 'Ceremony');
			}
			else if (readFlag(s, 'Fruitless')) {
				generateLine(page, 'Window 3');
				generateLine(page, 'Window 9');
				s = addFlag(s, 'Ceremony');
			}
			else {
				generateLine(page, 'Window 21');
			}
		}
		if (!readFlag(s, 'Ceremony')) {
			const tal = readFlag(s, 'Seized') && !readFlag(s, 'Groomed');
			const bq = readFlag(s, 'Bouquet');
			const fl = readFlag(s, 'Fruitless');
			const k = readMisc(s, 'K');
			if (tal && readFlag(s, 'Favoritism')) {
					generateLine(page, 'Window 3');
				if (fl && k >= 10) {
					generateSpecial(page, 'Make It Look Like An Accident', 'unlock');
				}
			}
			else if (tal && readFlag(s, 'Disillusioned')) {
				generateLine(page, 'Window 3');
			}
			else if ((readFlag(s, 'Seized') || (post && engA)) && !readFlag(s, 'Groomed')) {
				generateLine(page, 'Window 3');
			}
			else if (readAndFlags(s, ['Challenger', 'Matrimony'])) {
				generateLine(page, 'Window 3');
			}
			else if (bq && readFlag(s, 'Fruitless') && !readFlag(s, 'Rosethorn')) {
				generateLine(page, 'Window 3');
				generateLine(page, 'Window 7');
			}
			else if (bq && (readFlag(s, 'Bachelorette') || (readFlag(s, 'Regicide') && lucille))) {
				generateLine(page, 'Window 9');
			}
			else if (readOrFlags(s, ['Vassal', 'Ward'])) {
				generateLine(page, 'Window 3');
				if (fl) {
					generateLine(page, 'Window 9');			
				}
			}
			else if (readFlag(s, 'Feint')) {
				if (readFlag(s, 'Divided')) {
					generateLine(page, 'Window 21');
				}
				else if (readOrFlags(s, ['Prevention', 'Re-Prevention'])) {
					generateLine(page, 'Window 9');
				}
			}
			else if (readFlag(s, 'Earnest')) {
				if (readFlag(s, 'Exiles')) {
					generateLine(page, 'Window 21');
				}
				else {
					generateLine(page, 'Window 3');
				}
			}
			else if (readFlag(s, 'Obsession') && k < 5) {
				generateLine(page, 'Window 3');
				generateLine(page, 'Window 9');
			}
			else if (readFlag(s, 'Coven')) {
				generateLine(page, 'Window 9');
			}
			else if (readFlag(s, 'Challenger')) {
				generateLine(page, 'Window 3');
				if (readFlag(s, 'Troublemaker')) {
					generateLine(page, 'Window 12');
				}
			}
			else if (readFlag(s, 'Sous-Chef')) {
				if (readFlag(s, 'Taster')) {
					generateLine(page, 'Window 9');				
					if (readMisc(s, 'Ca') <= -20 || readMisc(s, 'Na') <= -20) {
						generateSpecial(page, 'An Unexpected Pairing', 'unlock');
						generateLine(page, 'Window 3');
					}
				}
				else if (k >= 5) {
					generateLine(page, 'Window 3');
					generateLine(page, 'Window 9');
				}
				else {
					generateLine(page, 'Window 9');
					if (readMisc(s, 'Ca') > 0 && readMisc(s, 'Na') > 0 && readAndNotFlags(s, ['Charity', 'Behemoth', 'Tremors']) && (!readFlag(s, 'Spartacus') || readOrFlags(s, ['Upjumped', 'Favoritism'] || (!readFlag(s, 'Ceremony') && (readFlag(s, 'Seized') || engA))))) {
						generateSpecial(page, 'An Unexpected Pairing', 'unlock');
						generateLine(page, 'Window 3');
					}
				}
			}
			else if (readFlag(s, 'Bear')) {
				if (readOrFlags(s, ['Edification', 'Confidence']) || (readFlag(s, 'Divided') && (!readFlag(s, 'United') || readAndNotFlags(s, ['Tattle', 'Help', 'Horrify'])))) {
					generateLine(page, 'Window 9');
				}
				else {
					generateLine(page, 'Window 21');
				}
			}
			else if (readFlag(s, 'Bull')) {
				generateLine(page, 'Window 9');
				if (readFlag(s, 'Duet')) {
					generateLine(page, 'Window 3');
				}
			}
			else if (readOrFlags(s, ['Proletariat', 'Oblation']) && readOrFlags(s, ['Unintended', 'Hysteria'])) {
				generateSpecial(page, 'An Unexpected Pairing', 'unlock');
				generateLine(page, 'Window 9');
			}
			else if (readSubgroup(s, 'military') + readSubgroup(s, 'intrigue') > readSubgroup(s, 'expression') + readSubgroup(s, 'conversation')) {
				generateLine(page, 'Window 3');
			}
			else if (k >= 5) {
				generateLine(page, 'Window 9');
			}
			else {
				generateLine(page, 'Window 3');
			}
		}
		if (readFlag(s, 'Printing')) {
			generateLine(page, 'Window 22');
		}
		if (readFlag(s, 'Hospital')) {
			generateLine(page, 'Window 23');
		}
		generateLine(page, 'Window 24');		
		return [s, page];
	}
	];

	const specificWeekends = [
	// 0
	{},
	// 1
	{
	'charlotte': {
		'direct': s => 1,
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			generateLine(page, 'C', false);
			s = offsetMood(s, 'C');
			s = addFlag(s, 'Playdate');
			return [s, page];
			}
		},
	'father': {
		'direct': s => 1,
		'generate': (s, n, c) => [offsetMood(s, 'L'), emptyDocumentCallback(s, n, c)]
		},
	'barracks': {
		'direct': directionCache['barracks1'],
		'generate': (s, n, c) => {
			const w = readMoodAxis(s, 'W');
			return [(w > 0) ? offsetMood(s, '-WP') : (w < 0) ? offsetMood(s, '-YP') : offsetMood(s, 'P'), emptyDocumentCallback(s, n, c)];
			}
		},
	'dungeons': {
		'direct': s => 1,
		'generate': (s, n, c) => {
				const w = readMoodAxis(s, 'W');
				if (readMisc(s, 'K') >= 5) {
					s = offsetMisc(s, {'K': 0.5});
					s = offsetMood(s, 'AC');
				}
				else if (w > 0) {
					s = offsetMood(s, 'AW');
				}
				else if (w < 0) {
					s = offsetMood(s, 'FY');
				}
				return [s, emptyDocumentCallback(s, n, c)];
			}
		}
	},
	// 2
	{
	'charlotte': {
		'direct': s => (!readFlag(s, 'Playdate')) ? 1 : 2,
		'generate': emptyGeneration
		},
	'father': {
		'direct': s => 2,
		'generate': (s, n, c) => [addFlag(s, 'Heartless'), emptyDocumentCallback(s,c)]
		},
	'julianna': {
		'direct': s => (readFlag(s, 'Mentor')) ? 2 : 0,
		'generate': (s, n, c) => [addFlag(s, 'Inheritance'), emptyDocumentCallback(s,c)]
		},
	'barracks': activityCache['barracks2'],
	'dungeons': {
		'direct': s => (readFlag(s, 'Dungeoness')) ? 2 : 1,
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment;
			s = addFlag(s, 'Caution');
			generateOptions(page, c, n, 'a', ['Listen', 'Ignore'], [true, true]);
			if (!c.hasOwnProperty(idPrefix + 'a')) {
			}
			else if (c[idPrefix + 'a'] === '1') {
				generateOptions(page, c, n, 'b', ['Free', 'Refuse'], [true, true]);
				if (!c.hasOwnProperty(idPrefix + 'b')) {
				}
				else if (c[idPrefix + 'b'] === '1') {
					generateLine(page, 'P', false);
					s = offsetMood(s, 'P');
					s = addFlag(s, 'Mentor');
				}
				else if (c[idPrefix + 'b'] === '2') {
					generateLine(page, 'AW', false);
					s = offsetMood(s, 'AW');
				}
			}
			else if (c[idPrefix + 'a'] === '2') {
				generateLine(page, 'F', false);
				s = offsetMood(s, 'F');
			}
			return [s, page];
			}
		}
	},
	// 3
	{
	'father': {
		'direct': s => (readFlag(s, 'Inheritance')) ? 3 : (!readFlag(s, 'Heartless')) ? 2 : 3,
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			if (readFlag(s, 'Inheritance') || readFlag(s, 'Assistant')) {
				generateLine(page, 'W', false);
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Intransigence');
				}
			else {
				generateLine(page, 'CY', false);
				s = offsetMood(s, 'CY');
				s = addFlag(s, 'Love');
				}
			return [s, page];
			}
		},
	'julianna': {
		'direct': s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : 3,
		'generate': (s, n, c) => [addFlag(s, 'Trust'), emptyDocumentCallback(s, n, c)]
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons3']
	},
	// 4
	{
	'father': {
		'direct': s => (readFlag(s, 'Inheritance') && !readFlag(s, 'Intransigence')) ? 3 : (readAndNotFlags(s, ['Trust', 'Heartless'])) ? 2 : (readAndNotFlags(s, ['Inheritance', 'Love'])) ? 3 : 0,
		'generate': emptyGeneration
		},
	'julianna': {
		'direct': s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : (readAndNotFlags(s, ['Intransigence', 'Trust'])) ? 3 : 4,
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			s = addFlag(s, 'Imperative');
			generateOptions(page, c, n, 'a', ['Wait', 'Find', 'What'], [true, true, true]);
			if (!c.hasOwnProperty(idPrefix + 'a')) {
			}
			else if (c[idPrefix + 'a'] === '1') {
				generateLine(page, 'Y');
				s = offsetMood(s, 'Y');
			}
			else if (c[idPrefix + 'a'] === '2') {
				generateLine(page, 'W');
				s = offsetMood(s, 'W');
				s = addFlag(s, 'Vanguard');
			}
			else if (c[idPrefix + 'a'] === '3') {
				s = addFlag(s, 'Vanguard');
			}
			return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons3']
	},
	// 5
	{
	'father': {
		'direct': s => (readFlag(s, 'Inheritance') && !readFlag(s, 'Intransigence')) ? 3 : (readAndNotFlags(s, ['Trust', 'Heartless'])) ? 2 : (readAndNotFlags(s, ['Inheritance', 'Love'])) ? 3 : 0,
		'generate': emptyGeneration
		},
	'julianna': {
		'direct': s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : (readAndNotFlags(s, ['Intransigence', 'Trust'])) ? 3 : (readFlag(s, 'Intransigence') && !readFlag(s, 'Imperative')) ? 4 : 0,
		'generate': emptyGeneration
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons3'],
	'treasury': {
		'direct': directionCache['treasury5'],
		'generate': (s, n, c) => {
			const acc = readSkill(s, 'account');
			const pre = readSkill(s,  'presence');
			if ((acc >= 60 || pre >= 70) && readAndNotFlags(s, ['Crystal', 'Consequences']) && readOrFlags(s, ['Mentor', 'Assistant']) && readOrFlags(s, ['Inheritance', 'Intransigence'])) {
				s = offsetMood(s, 'W');
				if (!readFlag(s, 'Regicide')) {
					s = addFlag(s, 'Crystal');
				}
			}
			else if (pre < 40 || acc >= 40 && pre < 70 && !readFlag(s, 'Crystal')) {
				s = offsetMood(s, 'AW');
				}
			else {
				s = offsetMood(s, 'W');
				}
			return [s, emptyDocumentCallback(s, n, c)];
			}
		}
	},
	// 6
	{
	'father': activityCache['father6'],
	'julianna': {
		'direct': directionCache['julianna6'],
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			s = addFlag(s, 'Liminality');
			generateOptions(page, c, n, 'a', ['Accept', 'Reject', 'Question'], [true, true, readFlag(s, 'Heartless')]);
			if (readFlag(s, 'Heartless') && 'a' === '3') {
				generateOptions(page, c, n, 'b', ['Proceed', 'Challenge'], [true, true]);
				if (!c.hasOwnProperty(idPrefix + 'b')) {
				}
				else if (c[idPrefix + 'b'] === '2') {
					generateLine(page, 'A')
					s = offsetMood(s, 'A');
				}
				if (c.hasOwnProperty(idPrefix + 'b') && c[idPrefix + 'b'] !== 'none') {
					generateOptions(page, c, n, 'c' ['Accept', 'Reject'], [true, true]);
				}
			}
			const f1 = c.hasOwnProperty(idPrefix + 'a')
			const f2 = c.hasOwnProperty(idPrefix + 'c');
			if (f1 && c[idPrefix + 'a'] === '1' || f2 && c[idPrefix + 'c'] === '1') {
				generateLine(page, '2CW', false);
				generateSpecial(page, 'Illuminate!', 'unlock', false);
				s = offsetMood(s, '2CW');
				s = addFlag(s, 'Lumen');
			}
			else if (f1 && c[idPrefix + 'a'] === '2' || f2 && c[idPrefix + 'c'] === '2') {
				generateLine(page, 'Y', false);
				s = offsetMood(s, 'Y');
				s = addFlag(s, 'Mundanity');
			}
			return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons3'],
	'treasury': activityCache['treasury6']
	},
	// 7
	{
	'father': activityCache['father6'],
	'julianna': activityCache['julianna7'],
	'selene': {
		'direct': s => (readAndFlags(s, ['Assistant', 'Intransigence']) && !readFlag(s, 'Imperative')) ? 7 : 0,
		'generate': (s, n, c) => {
				const page = new DocumentFragment();
				generateLine(page, 'F', false);
				s = offsetMood(s, 'F');
				s = addFlag(s, 'Imperative')
				return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': {
		'direct': directionCache['dungeons7'],
		'generate': (s, n, c) => {
				const idPrefix = 'week' + n + '-';
				const page = new DocumentFragment();
				s = addFlag(s, 'Brazenness');
				generateOptions(page, c, n, 'a', ['Taunt', 'Execute', 'Ignore'], [true, true, true]);
				if (!c.hasOwnProperty(idPrefix + 'a')) {
				}
				else if (c[idPrefix + 'a'] === '1') {
					generateLine(page, 'A', false);
					s = offsetMood(s, 'A');
				}
				else if (c[idPrefix + 'a'] === '2') {
					generateLine(page, 'A', false);
					s = offsetMood(s, 'A');
					generateSpecial(page, 'Off with Their Heads', 'unlock', false);
					generateSpecial(page, 'Chocked on Magical Chains', 'death', false);
				}
				else if (c[idPrefix + 'a'] === '3') {
					generateLine(page, 'F', false);
					s = offsetMood(s, 'F');
				}
				return [s, page];
			}
		},
	'treasury': activityCache['treasury6']
	},
	// 8
	{
	'father': activityCache['father6'],
	'julianna': activityCache['julianna7'],
	'selene': {
		'direct': directionCache['selene9'],
		'generate': (s, n, c) => {
				const idPrefix = 'week' + n + '-';
				const page = new DocumentFragment();
				s = addFlag(s, 'Liminality');
				generateOptions(page, c, n, 'a', ['Accept', 'Reject', 'Question'], [true, true, readFlag(s, 'Heartless')]);
				if (readFlag(s, 'Heartless') && c[idPrefix + 'a'] === '3') {
					generateOptions(page, c, n, 'b', ['Accept', 'Reject', 'Mother'], [true, true, true]);
				}
				if (readFlag(s, 'Heartless') && c[idPrefix + 'b'] === '3') {
					generateOptions(page, c, n, 'c', ['Accept', 'Reject'], [true, true]);
				}
				const [f1, f2, f3] = [c.hasOwnProperty(idPrefix + 'a'), c.hasOwnProperty(idPrefix + 'b'), c.hasOwnProperty(idPrefix + 'c')];
				if (f1 && c[idPrefix + 'a'] === '1' || f2 && c[idPrefix + 'b'] === '1' || f3 && c[idPrefix + 'c'] === '1') {
					generateLine(page, 'CW', false);
					s = offsetMood(s, 'CW');
					s = addFlag(s, 'Lumen');
					generateSpecial(page, 'Illuminate!', 'unlock', false);
				}
				else if (f1 && c[idPrefix + 'a'] === '2' || f2 && c[idPrefix + 'b'] === '2' || f3 && c[idPrefix + 'c'] === '2') {
					generateLine(page, 'Y', false);
					s = offsetMood(s, 'Y');
					s = addFlag(s, 'Mundanity');
				}
			return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons8'],
	'treasury': activityCache['treasury6']
	},
	// 9
	{
	'father': activityCache['father6'],
	'julianna': {
		'direct': directionCache['julianna9'],
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			if (readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) {
				s = addFlag(s, 'Glow');
				generateOptions(page, c, n, 'a', ['Drop', 'Push'], [true, true]);
				if (!c.hasOwnProperty(idPrefix + 'a')) {
				}
				else if (c[idPrefix + 'a'] === '1') {
					generateLine(page, 'Y');
					s = offsetMood(s, 'Y');
				}
				else if (c[idPrefix + 'a'] === '2') {
					generateLine(page, 'W');
					s = offsetMood(s, 'W');
					if (readFlag(s, 'Kin') && !readFlag(s, 'Cousin')) {
						s = addFlag(s, 'Penpal');
					}
				}
			}
			else {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
				s = addFlag(s, 'Sensor');
				generateOptions(page, c, n, 'b', ['Insist', 'Allow'], [true, true]);
				if (!c.hasOwnProperty(idPrefix + 'b')) {
					}
				else if (c[idPrefix + 'b'] === '1' && (readSkill(s, 'lore') < 70 || readSkill(s, 'presence') < 40 && readSubgroup(s, 'conversation') < 60)) {
					generateLine(page, 'A', false);
					s = offsetMood(s, 'A');
					}
				else if (c[idPrefix + 'b'] === '2') {
					generateLine(page, 'Y', false);
					s = offsetMood(s, 'Y');
					}
				}
			return [s, page];
			}
		},
	'selene': {
		'direct': directionCache['selene9'],
		'generate': (s, n, c) => {
			s = addFlag(s, 'Glow');
			if (!readFlag(s, 'Backtracked') && readFlag(s, 'Kin') && !readFlag(s, 'Cousin')) {
				s = addFlag(s, 'Penpal');
				}
			return [s, new DocumentFragment()];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons8'],
	'treasury': activityCache['treasury6']
	},
	// 10
	{
	'father': {
		'direct': s => (readAndNotFlags(s, ['Crystal', 'Intransigence']) && readOrFlags(s, ['Inheritance', 'Assistant'])) ? 3 : (readAndNotFlags(s, ['Trust', 'Heartless', 'Assistant'])) ? 2 : (readFlag(s, 'Rebuffed') && readAndNotFlags(s, ['Charade', 'Retrospective'])) ? 10 : 0,
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			generateLine(page, 'YP');
			s = offsetMood(s, 'YP');
			s = addFlag(s, 'Retrospective');
			return [s, page];
			}
		},
	'julianna': activityCache['julianna10'],
	'selene': activityCache['selene10'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons8'],
	'treasury': activityCache['treasury6']
	},
	// 11
	{
	'father': activityCache['father11'],
	'julianna': activityCache['julianna10'],
	'selene': activityCache['selene10'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons8'],
	'treasury': activityCache['treasury6']
	},
	// 12
	{
	'father': activityCache['father11'],
	'julianna': activityCache['julianna10'],
	'selene': activityCache['selene10'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons8'],
	'treasury': activityCache['treasury6']
	},
	// 13
	{
	'father': activityCache['father11'],
	'julianna': activityCache['julianna10'],
	'selene': activityCache['selene10'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons8'],
	'treasury': activityCache['treasury6']
	},
	// 14
	{
	'father': activityCache['father11'],
	'julianna': activityCache['julianna10'],
	'selene': activityCache['selene10'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons8'],
	'treasury': activityCache['treasury6']
	},
	// 15
	{
	'father': activityCache['father11'],
	'julianna': activityCache['julianna10'],
	'selene': activityCache['selene10'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons8'],
	'treasury': activityCache['treasury6']
	},
	// 16
	{
	'father': activityCache['father6'],
	'julianna': {
	 	'direct': directionCache['julianna16'],
		'generate': (s, n, c) => {
				const idPrefix = 'week' + n + '-';
				const page = new DocumentFragment();
				s = addFlag(s, 'Threshold');
				generateOptions(page, c, n, 'a', ['Accept', 'Reject'], [true, true]);
				if (!c.hasOwnProperty(idPrefix + 'a')) {
				}
				else if (c[idPrefix + 'a'] === '1') {
					generateLine(page, '2CW', false);
					generateSpecial(page, 'Illuminate!', 'unlock');
					s = offsetMood(s, '2CW');
					s = addFlag(s, 'Lumen');
				}
				else if (c[idPrefix + 'a'] === '2') {
					generateLine(page, 'F');
					s = offsetMood(s, 'F');
				}
				return [s, page];
			}
		},
	'selene': {
		'direct': directionCache['selene16'],
		'generate': (s, n, c) => {
				const idPrefix = 'week' + n + '-';
				const page = new DocumentFragment();
				s = addFlag(s, 'Threshold');
				generateOptions(page, c, n, 'b', ['Accept', 'Reject'], [true, true]);
				if (!c.hasOwnProperty(idPrefix + 'b')) {
				}
				else if (c[idPrefix + 'b'] === '1') {
					generateLine(page, 'CW', false);
					generateSpecial(page, 'Illuminate!', 'unlock');
					s = offsetMood(s, 'CW');
					s = addFlag(s, 'Lumen');
				}
				else if (c[idPrefix + 'b'] === '2') {
					generateLine(page, 'F');
					s = offsetMood(s, 'F');
				}
				return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': {
		'direct': x => 1,
		'generate': emptyGeneration
		},
	'treasury': activityCache['treasury6']
	},
	// 17
	{
	'father': activityCache['father6'],
	'julianna': {
		'direct': directionCache['julianna16'],
		'generate': emptyGeneration
		},
	'selene': {
		'direct': directionCache['selene16'],
		'generate': emptyGeneration
		},
	'barracks': activityCache['barracks2'],
	'dungeons': {
		'direct': s => (readFlag(s, 'Machination')) ? 17 : 1,
		'generate': emptyGeneration
		},
	'treasury': activityCache['treasury6']
	},
	// 18
	{
	'father': activityCache['father6'],
	'julianna': {
		'direct': s => (!readFlag(s, 'Mentor')) ? 0 : (!readFlag(s, 'Inheritance')) ? 2 : (readOrFlags(s, ['Accusation', 'Instigation']) || (readAndNotFlags(s, ['Crystal', 'Ultimatum']) && readFlag(s, 'Vanguard'))) ? 18 : (readAndNotFlags(s, ['Intransigence', 'Crystal', 'Trust'])) ? 3 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Crystal', 'Imperative'])) ? 4 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 6 : ((readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) || (readFlag(s, 'Priestess') && !readFlag(s, 'Sensor'))) ? 9 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : 0,
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			if (readFlag(s, 'Accusation') || readFlag(s, 'Instigation')) {
				if (readSkill(s, 'lore') >= 100) {
					generateLine(page, 'P');
					s = offsetMood(s, 'P');
				}
				else {
					generateLine(page, 'FY');
					s = offsetMood(s, 'FY');
				}
			}
			else {
				s = addFlag(s, 'Ultimatum');
				generateOptions(page, c, n, 'a', ['Wait', 'Allow'], [true, true]);
				if (!c.hasOwnProperty(idPrefix + 'a')) {
				}
				else if (c[idPrefix + 'a'] === '2') {
					generateLine(page, 'DY, -450G');
					s = offsetMood(s, 'DY');
					s = offsetMisc(s, {'Na': -10, 'G': -450});
					s = addFlag(s, 'Consequences');
				}
			}
			return [s, page];
			}
		},
	'selene': {
		'direct': s => (!readFlag(s, 'Assistant')) ? 0 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 8 : (readOrFlags(s, ['Accusation', 'Instigation'])) ? 18 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Lumen', 'Imperative'])) ? 7 : (readAndFlags(s, ['Intransigence', 'Imperative']) && readAndNotFlags(s, ['Crystal', 'Ultimatum'])) ? 18 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) ? 9 : 0,
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			if (readFlag(s, 'Accusation') || readFlag(s, 'Instigation')) {
				if (readSkill(s, 'lore') >= 100) {
					generateLine(page, 'P');
					s = offsetMood(s, 'P');
				}
				else {
					generateLine(page, 'FY');
					s = offsetMood(s, 'FY');
				}
			}
			else {
				s = addFlag(s, 'Ultimatum');
				generateOptions(page, c, n, 'b', ['Wait', 'Allow'], [true, true]);
				if (!c.hasOwnProperty(idPrefix + 'b')) {
				}
				else if (c[idPrefix + 'b'] === '2') {
					generateLine(page, 'DY, -450G');
					s = offsetMood(s, 'DY');
					s = offsetMisc(s, {'Na': -10, 'G': -450});
					s = addFlag(s, 'Consequences');
				}
			}
			return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': {
		'direct': directionCache['dungeons18'],
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			s = addFlag(s, 'Madness');
			if (readMoodAxis(s, 'F') > 0) {
				generateLine(page, 'FP');
				s = offsetMood(s, 'FP');
			}
			else if (readMoodAxis(s, 'A') > 0) {
				generateLine(page, 'A');
				s = offsetMood(s, 'A');
			}
			return [s, page];
			}
		},
	'treasury': activityCache['treasury6']
	},
	// 19
	{
	'father': activityCache['father6'],
	'julianna': {
		'direct': directionCache['julianna19'],
		'generate': (s, n, c) => {
				const page = new DocumentFragment();
				if (readMisc(s, 'K') < 5) {
					const d = (readMoodAxis(s, 'D') < 0) ? '-5CP' : '-DP';
					generateLine(page, d, false);
					s = offsetMood(s, d);
				}
				else {
					generateLine(page, 'CW', false);
					s = offsetMood(s, 'CW');
				}
				s = addFlag(s, 'Lumen');
				generateSpecial(page, 'Illuminate!', 'unlock');
				return [s, page];
			}
		},
	'selene': {
		'direct': s => (!readFlag(s, 'Assistant')) ? 0 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 8 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Lumen', 'Imperative'])) ? 7 : (readAndFlags(s, ['Intransigence', 'Imperative']) && readAndNotFlags(s, ['Crystal', 'Ultimatum'])) ? 18 : (!readFlag(s, 'Lumen') && readFlag(s, 'Consequences')) ? 19 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) ? 9 : 0,
		'generate': (s, n, c) => {
				const page = new DocumentFragment();
				if (readMisc(s, 'K') < 5) {
					const d = (readMoodAxis(s, 'D') < 0) ? '-5CP' : '-DP';
					generateLine(page, d, false);
					s = offsetMood(s, d);
				}
				else {
					generateLine(page, 'CW', false);
					s = offsetMood(s, 'CW');
				}
				s = addFlag(s, 'Lumen');
				generateSpecial(page, 'Illuminate!', 'unlock');
				return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 20
	{
	'father': activityCache['father6'],
	'julianna': {
		'direct': directionCache['julianna19'],
		'generate': emptyGeneration,
		},
	'selene': {
		'direct': s => (!readFlag(s, 'Assistant')) ? 0 : (readFlag(s, 'Purification')) ? 20 : (readFlag(s, 'Crystal') && !readFlag(s, 'Liminality')) ? 8 : (readFlag(s, 'Intransigence') && readAndNotFlags(s, ['Lumen', 'Imperative'])) ? 7 : (readAndFlags(s, ['Intransigence', 'Imperative']) && readAndNotFlags(s, ['Crystal', 'Ultimatum'])) ? 18 : (!readFlag(s, 'Lumen') && readFlag(s, 'Consequences')) ? 19 : (readAndFlags(s, ['Portent', 'Potential']) && readAndNotFlags(s, ['Lumen', 'Threshold'])) ? 16 : (readFlag(s, 'Lumen') && readSkill(s, 'meditate') >= 80 && !readFlag(s, 'Glow')) ? 9 : 0,
		'generate': (s, n, c) => {
				const page = new DocumentFragment();
				generateLine(page, 'P');
				s = offsetMood(s, 'P');
				return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 21
	{
	'father': {
		'direct': directionCache['father21'],
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			s = addFlag(s, 'Artifact');
			return [s, page];
			}
		},
	'julianna': {
		'direct': directionCache['julianna21'],
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			generateLine(page, 'P');
			s = offsetMood(s, 'P');
			s = addFlag(s, 'Prismatics');
			return [s, page];
			}
		},
	'selene': {
		'direct': directionCache['selene21'],
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			generateLine(page, 'P');
			s = offsetMood(s, 'P');
			s = addFlag(s, 'Prismatics');
			return [s, page];
			}
		},
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 22
	{
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 23
	{
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'sabine': {
		'direct': s => (readFlag(s, 'Agent')) ? 23 : 0,
		'generate' : emptyGeneration
		},
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 24
	{
	'adair': {
		'direct': directionCache['adair24'],
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			s = addFlag(s, 'Fiance');
			generateOptions(page, c, n, 'a', ['Allow', 'Decline', 'Reject'], [true, true, true]);
			if (!c.hasOwnProperty(idPrefix + 'a')) {
			}
			else if (c[idPrefix + 'a'] === '1') {
				generateSpecial(page, "Youth's First Kiss", 'unlock');
			}
			else if (c[idPrefix + 'a'] === '3') {
				s = offsetMisc(s, {'K': 0.5});
			}
			return [s, page];
			}
		},
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 25
	{
	'adair': activityCache['adair25'],
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 26
	{
	'adair': activityCache['adair25'],
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 27
	{
	'adair': activityCache['adair25'],
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 28
	{
	'adair': activityCache['adair25'],
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 29
	{
	'father': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : directionCache['father21'](s),
		'generate': emptyGeneration
		},
	'julianna': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : directionCache['julianna21'](s),
		'generate': emptyGeneration
		},
	'selene': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : directionCache['selene21'](s),
		'generate': emptyGeneration
		},
	'barracks': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : directionCache['barracks1'](s),
		'generate': emptyGeneration
		},
	'dungeons': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : directionCache['dungeons18'](s),
		'generate': emptyGeneration
		},
	'treasury': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : directionCache['treasury5'](s),
		'generate': emptyGeneration
		},
	'ball': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : (weekendActivities['ball'].condition(s)) ? 29 : 0,
		'generate': weekendActivities['ball'].generate
		},
	'castle': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : 29,
		'generate': weekendActivities['castle'].generate
		},
	'court': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : 29,
		'generate': weekendActivities['court'].generate
		},
	'gardens': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : 29,
		'generate': weekendActivities['gardens'].generate
		},
	'hunt': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : (weekendActivities['hunt'].condition(s)) ? 29 : 0,
		'generate': weekendActivities['hunt'].generate
		},
	'service': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : (weekendActivities['service'].condition(s)) ? 29 : 0,
		'generate': weekendActivities['service'].generate
		},
	'sneak': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : 29,
		'generate': weekendActivities['sneak'].generate
		},
	'sports': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : (weekendActivities['sports'].condition(s)) ? 29 : 0,
		'generate': weekendActivities['sports'].generate
		},
	'tomb': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : 29,
		'generate': weekendActivities['tomb'].generate
		},
	'toys': {
		'direct': s => (readFlag(s, 'Adventure')) ? 0 : 29,
		'generate': weekendActivities['toys'].generate
		},
	},
	// 30
	{
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 31
	{
	'adair': {
		'direct': directionCache['adair31'],
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			s = addFlag(s, 'Engagements');
			generateOptions(page, c, n, 'a', ['Lie', 'Gentle', 'Brag'], [true, true, true]);
			if (!c.hasOwnProperty(idPrefix + 'a')) {
			}
			else if(c[idPrefix + 'a'] === '1') {
				generateLine(page, 'P');
				s = offsetMood(s, 'P');
			}
			else if(c[idPrefix + 'a'] === '2') {
				generateLine(page, 'D');
				s = offsetMood(s, 'D');
			}
			else if(c[idPrefix + 'a'] === '3') {
				s = offsetMisc(s, {'K': 1});
			}
			return [s, page];
			}
		},
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 32
	{
	'adair': activityCache['adair32'],
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 33
	{
	'adair': activityCache['adair32'],
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'sabine': {
		'direct': s => readAndFlags(s, ['Agent', 'Aria']) ? 33 : 0,
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			generateOptions(page, c, n, 'a', ['Accept', 'Decline', 'Flirt'], [true, true, true]);
			if (!c.hasOwnProperty(idPrefix + 'a')) {
			}
			else if (c[idPrefix + 'a'] === '1') {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else if (c[idPrefix + 'a'] === '2') {
				generateLine(page, 'P');
				s = offsetMood(s, 'P');
			}
			else if (c[idPrefix + 'a'] === '3') {
				generateLine(page, '-C');
				s = offsetMood(s, '-C');
			}
			return [s, page];
			}
		},
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 34
	{
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'barracks': activityCache['barracks2'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 35
	{
	'barracks': {
		'direct': directionCache['barracks35'],
		'generate': (s, n, c) => [offsetMood(s, 'DP'), emptyDocumentCallback(s, n, c)]
		},
	'father': activityCache['father22'],
	'julianna': activityCache['julianna22'],
	'selene': activityCache['selene22'],
	'dungeons': activityCache['dungeons19'],
	'treasury': activityCache['treasury6']
	},
	// 36
	{
	'advisors': {
		'direct': s => readAndFlags(s, ['Unyielding', 'Assistant']) ? 37 : (readFlag(s, 'Unyielding')) ? 36 : 0,
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			generateOptions(page, c, n, 'a', ['Alone', 'Together'], [true, true]);
			if (c.hasOwnProperty(idPrefix + 'a') && c[idPrefix + 'a'] === '2') {
				generateLine(page, 'D', false);
				s = offsetMood(s, 'D');
			}
			generateSpecial(page, 'Game Over', 'loss');
			return [s, page];
			}
		},
	'father': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Regicide']) ? 0 : readFlag(s, 'Mirrored') ? 36 : directionCache['father21'](s),
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			generateLine(page, 'DL', false);
			generateSpecial(page, 'A Mysterious Artifact', 'unlock');
			s = offsetMood(s, 'DL');
			s = addFlag(s, 'Sleepless');
			return [s, page];
			}
		},
	'julianna': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : readAndFlags(s, ['Regicide', 'Mentor']) ? 36 : directionCache['julianna21'](s),
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			generateLine(page, 'A');
			s = offsetMood(s, 'A');
			s = addFlag(s, 'Mentored');
			generateOptions(page, c, n, idPrefix + 'b', ['Accept', 'Refuse'], [true, true]);
			if (c.hasOwnProperty(idPrefix + 'b') && c[idPrefix + 'b'] === '1') {
				s = addFlag(s, 'Re-Lumen');
			}
			return [s, page];
			}
		},
	'selene': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : readAndFlags(s, ['Regicide', 'Assistant']) ? 36 : directionCache['selene21'](s),
		'generate': (s, n, c) => {
			const idPrefix = 'week' + n + '-';
			const page = new DocumentFragment();
			generateLine(page, 'A');
			s = offsetMood(s, 'A');
			s = addFlag(s, 'Mentored');
			generateOptions(page, c, n, idPrefix + 'c', ['Accept', 'Refuse'], [true, true]);
			if (c.hasOwnProperty(idPrefix + 'c') && c[idPrefix + 'c'] === '1') {
				s = addFlag(s, 'Re-Lumen');
			}
			return [s, page];
			}
		},
	'dungeons': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : directionCache['dungeons18'](s),
		'generate': emptyGeneration
		},
	'ball': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : (weekendActivities['ball'].condition(s)) ? 36 : 0,
		'generate': weekendActivities['ball'].generate
		},
	'barracks': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : directionCache['barracks35'](s),
		'generate': emptyGeneration
		},
	'castle': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : 36,
		'generate': weekendActivities['castle'].generate
		},
	'court': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : 36,
		'generate': (s, n, c) => (readFlag(s, 'Regicide')) ? [offsetMood(offsetMisc(s, {'Ca': 1, 'Na': 1}), '2Y2P'), emptyDocumentCallback(s, n, c)] : weekendActivities['court'].generate(s, n, c)
		},
	'gardens': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : 36,
		'generate': weekendActivities['gardens'].generate
		},
	'hunt': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : (weekendActivities['hunt'].condition(s)) ? 36 : 0,
		'generate': weekendActivities['hunt'].generate
		},
	'service': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : (weekendActivities['service'].condition(s)) ? 36 : 0,
		'generate': weekendActivities['service'].generate
		},
	'sneak': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : 36,
		'generate': (s, n, c) => (readFlag(s, 'Regicide')) ? [offsetMood(s, 'DWL'), emptyDocumentCallback(s, n, c)] : weekendActivities['sneak'].generate(s, n, c)
		},
	'sports': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : (weekendActivities['sports'].condition(s)) ? 36 : 0,
		'generate': weekendActivities['sports'].generate
		},
	'tomb': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : 36,
		'generate': weekendActivities['tomb'].generate
		},
	'toys': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : 36,
		'generate': weekendActivities['toys'].generate
		},
	'treasury': {
		'direct': s => readOrFlags(s, ['Unyielding', 'Mirrored']) ? 0 : directionCache['treasury5'](s),
		'generate': emptyGeneration
		}
	},
	// 37
	{
	'adair': {
		'direct': directionCache['adair37'],
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			generateLine(page, '-D-L');
			s = offsetMood(s, '-D-L');
			s = addFlag(s, 'Diminutives');
			return [s, page];
			}
		},
	'advisors': {
		'direct': s => 0,
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			const med = readSkill(s, 'meditate');
			const lumen = readSubgroup(s, 'lumen');
			if (med < 10) {
				generateLine(page, 'F');
				s = offsetMood(s, 'F');
			}
			if ((lumen >= 300 && med >= 10) || (lumen >= 240 && med >= 60)) {
				generateSpecial(page, 'Fault Lines', 'unlock');
				generateLine(page, '-4000G');
				s = offsetMisc(s, {'Ca': -20, 'G': -4000});
				s = addFlag(s, 'Tremors');
			}
			else {
				generateSpecial(page, 'Blown Yourself Up', 'death');
			}
			return [s, page];
			}
		},
	'father': activityCache['father37'],
	'julianna': activityCache['julianna37'],
	'selene': activityCache['selene37'],
	'barracks': activityCache['barracks37'],
	'court': activityCache['court37'],
	'dungeons': activityCache['dungeons19'],
	'sneak':  activityCache['sneak37'],
	'treasury': activityCache['treasury6']
	},
	// 38
	{
	'adair': activityCache['adair38'],
	'charlotte': {
		'direct': directionCache['charlotte38'],
		'generate': (s, n, c) => {
			const page = new DocumentFragment();
			s = addFlag(s, 'Reunion');
			if (readFlag(s, 'Heritage')) {
				generateLine(page, 'C');
				s = offsetMood(s, 'C');
			}
			else if (readOrFlags(s, ['Machination', 'Scapegoat'])) {
				generateLine(page, 'D');
				s = offsetMood(s, 'D');
			}
			else {
				const d = (readMoodAxis(s, 'D') < 0) ? '-5C' : '-D';
				generateLine(page, d);
				s = offsetMood(s, d);
			}
			return [s, page];
			}
		},
	'father': activityCache['father37'],
	'julianna': activityCache['julianna37'],
	'selene': activityCache['selene37'],
	'barracks': activityCache['barracks37'],
	'court': activityCache['court37'],
	'dungeons': activityCache['dungeons19'],
	'sneak':  activityCache['sneak37'],
	'treasury': activityCache['treasury6']
	},
	// 39
	{
	'adair': activityCache['adair38'],
	'charlotte': {
		'direct': directionCache['charlotte38'],
		'generate': emptyGeneration
		},
	'father': activityCache['father37'],
	'julianna': activityCache['julianna37'],
	'selene': activityCache['selene37'],
	'barracks': activityCache['barracks37'],
	'court': activityCache['court37'],
	'dungeons': activityCache['dungeons19'],
	'sneak':  activityCache['sneak37'],
	'treasury': activityCache['treasury6'],
	}
	];

	function findWeekActivity(n, s, c) {
		return weekCallbacks[n](s, c);
	};

	function findAvailableThisWeekend(n, s) {
		return Object.fromEntries(Object.entries(specificWeekends[n]).map(x => [x[0], x[1], x[1].direct(s)]).filter(x => x[2] > 0).map(x => [x[0], specificWeekends[x[2]][x[0]]]));
	};

	function findAvailableAllWeekends(s) {
		return Object.fromEntries(Object.entries(weekendActivities).filter(x => x[1].condition(s)).map(x => [x[0], x[1]]));
	};

	function readActivityOptionText(a, s) {
		return maps.weekend[a].name + ' (' + weekendActivities[a].preview(s) + ')';
	};

	function hasCustomActivity(n, k) {
		return specificWeekends[n].hasOwnProperty(k);
	}

	return [findWeekActivity, findAvailableThisWeekend, findAvailableAllWeekends, readActivityOptionText, hasCustomActivity];
})();

/* Common page generation */
const [generateWeek, generateWeekend] = (function() {

	function generateHeader(n) {
		const e = document.createElement('h3');
		e.appendChild(document.createTextNode('Week ' + n));
		return e;
	};

	function generateMisc(s) {
		const page = new DocumentFragment();
		page.appendChild(document.createTextNode(determineMoodName(s) + ', ' + determineMiscString(s)));
		page.appendChild(document.createElement('br'));
		return page;
	};

	function generateSelection(n, title, suffix, includeNone, options, matchCallback, nameCallback, breakAfter) {
		const page = new DocumentFragment();
		let e, f;
		e = document.createElement('label');
		e.appendChild(document.createTextNode(title));
		page.appendChild(e);
		e = document.createElement('select');
		e.setAttribute('id', 'week' + n + '-' + suffix);
		e.setAttribute('onchange', 'rebuildContent(this.id)');
		if (includeNone) {
			f = document.createElement('option');
			f.setAttribute('value', 'none');
			if (matchCallback('none')) {
				f.setAttribute('selected', '');
			}
			f.appendChild(document.createTextNode('None Selected'));
			e.appendChild(f);
		}
		options.forEach(shortName => {
			f = document.createElement('option');
			f.setAttribute('value', shortName);
			if (matchCallback(shortName)) {
				f.setAttribute('selected', '');
			}
			f.appendChild(document.createTextNode(nameCallback(shortName)));
			e.appendChild(f);
		});
		page.appendChild(e);
		if (breakAfter) {
			page.appendChild(document.createElement('br'));
		}
		return page;
	};

	function generateOutfits(n, s, outfit, dirty) {
		const outfits = readUnlockedOutfits(s);
		const current = readCurrentOutfit(s);
		return generateSelection(n, 'Outfit: ', 'outfit', false, outfits, shortName => !dirty && shortName === current || dirty && shortName === outfit, readOutfitName, true);
	};

	function generateSkills(n, s, s1, s2) {
		const page = new DocumentFragment();
		const skills = readUnlockedSkills(s);
		const m = determineMood(s);
		page.appendChild(generateSelection(n, 'Mornings: ', 'morning', true, skills, shortName => shortName === s1, shortName => getSkillOptionText(m, shortName, false)));
		if (s1 !== 'none' && s1 !== s2) {
			page.appendChild(document.createTextNode(' --> ' + readSkill(safeTrainSkills(s, s1, s2), s1)));
		}
		page.appendChild(document.createElement('br'));
		page.appendChild(generateSelection(n, 'Evenings: ', 'evening', true, skills, shortName => shortName === s2, shortName => getSkillOptionText(m, shortName, false)));
		if (s2 !== 'none') {
			page.appendChild(document.createTextNode(' --> ' + readSkill(safeTrainSkills(s, s1, s2), s2)));
		}
		page.appendChild(document.createElement('br'));
		return page;
	};

	function generateWeekSpecifics(n, s, c) {
		const page = new DocumentFragment();
		let e;
		[s, e] = findWeekActivity(n, s, c);
		page.appendChild(e);
		page.appendChild(document.createElement('br'));
		return [s, page];
	};

	function generateWeekendActivity(s, n, c, act) {
		const page = new DocumentFragment();
		let e;
		[s, e] = act.generate(s, n, c);
		page.appendChild(e);
		return [s, page];
	};

	function generateWeek(n, s, o, d, s1, s2, c) {
		const page = new DocumentFragment();
		let e;
		page.appendChild(generateHeader(n));
		page.appendChild(generateMisc(s));
		page.appendChild(generateOutfits(n, s, o, d));
		s = (!d || o === readCurrentOutfit(s)) ? s : equipOutfit(s, o);
		page.appendChild(generateSkills(n, s, s1, s2))
		s = safeTrainSkills(s, s1, s2);
		[s, e] = generateWeekSpecifics(n, s, c);
		page.appendChild(e);
		return [s, page];
	};

	function generateWeekend(n, s, a, c) {
		const page = new DocumentFragment();
		let e;
		if (n >= 40) {
			return [s, page];
		}
		const acts = findAvailableThisWeekend(n, s);
		const defaults = findAvailableAllWeekends(s);
		Object.entries(defaults).forEach(x => {
			if (!hasCustomActivity(n, x[0])) {
				acts[x[0]] = x[1];
			}
		});
		page.appendChild(generateSelection(n, 'Weekend: ', 'weekend', true, Object.keys(acts), k => k === a, k => readActivityOptionText(k, s), true));
		if (a !== 'none' && acts.hasOwnProperty(a)) {
			[s, e] = generateWeekendActivity(s, n, c, acts[a]);
			page.appendChild(e);
		}
		return [s, page];
	};

	return [generateWeek, generateWeekend];
})();

/* Reads user choices from page */
function getSelections(n, textMode = false) {
	const oElement = document.getElementById('week' + n + '-outfit');
	const s1Element = document.getElementById('week' + n + '-morning');
	const s2Element = document.getElementById('week' + n + '-evening');
	const aElement = document.getElementById('week' + n + '-weekend');
	const cElements = document.getElementsByClassName('week' + n);
	const outfit = (oElement === null) ? 'base' : oElement.value;
	const skill1 = (s1Element === null) ? 'none' : s1Element.value;
	const skill2 = (s2Element === null) ? 'none' : s2Element.value;
	const activity = (aElement === null) ? 'none' : aElement.value;
	const m = cElements.length;
	let c = {};
	for (let k = 0; k < m; k++) {
		c[cElements[k].id] = (!textMode) ? cElements[k].value : [cElements[k].value, Array.prototype.find.call(cElements[k].childNodes, x => x.value === cElements[k].value).text];
	}
	return [outfit, skill1, skill2, activity, c];
};

/* Main loop */
const [generateContent, rebuildContent] = (function() {

	function createReportButton() {
		const e = document.createElement('button');
		e.setAttribute('type', 'button');
		e.setAttribute('class', 'flexfix');
		e.setAttribute('onClick', 'generateReport()');
		e.appendChild(document.createTextNode('Show Log'));
		return e;
	};

	// Miscellaneous end of week behavior
	function endWeek(old, m) {
		let ret = cloneState(old);
		if (m === 'I') {
			ret.moodStats[0] = 0; // Clear injured mood
		}
		ret = offsetMisc(ret, {'G': -0.25}); // Game has -U(0.01, 0.49) G (lassi) each week for some reason?
		return [ret, readFlag(old, 'Tremors')]; // Potential week skip
	};

	// Initial setup
	const state = State();
	const progress = [
		{
		's': findWeekActivity(0, state, null)[0],
		'clean': true,
		'page': null
		}
	];

	function generateContent(force = false) {

		const doc = new DocumentFragment();
		let s, m, clean, page, subpage;
		let o, s1, s2, a, c;
		let weekSkip = false;

		for (let n = 1; n < 41; n++) {

			if (!force) {
				({s, clean, page} = progress[n]);
			}

			if (force || !clean) {
				({s, clean, page} = progress[n - 1]);
				page = document.createElement('span');
				page.setAttribute('class', 'flexitem');
				m = determineMood(s);
				[o, s1, s2, a, c] = getSelections(n);

				if (!weekSkip) {
					[s, subpage] = generateWeek(n, s, o, !force, s1, s2, c);
					page.appendChild(subpage);
				}

				[s, subpage] = generateWeekend(n, s, a, c);
				page.appendChild(subpage);

				[s, weekSkip] = endWeek(s, m);
				weekSkip = weekSkip && (n === 36);

				progress[n] = {'s': s, 'clean': true, 'page': page};
				force = true;
			}

			doc.appendChild(page.cloneNode(true));
		}
		doc.appendChild(createReportButton());
		return doc;
	};

	function rebuildContent(id) {
		const hyphenPos = id.indexOf('-');
		const week = Number.parseInt(id.substring(4, hyphenPos));
		progress[week].clean = false;
		const updated = generateContent();
		document.body.innerHTML = '';
		document.body.appendChild(updated);
	};

	return [generateContent, rebuildContent];
})();

/* Log reporting */
const generateReport = (function() {

	function createRevertButton() {
		const e = document.createElement('button');
		e.setAttribute('type', 'button');
		e.setAttribute('class', 'flexfix');
		e.setAttribute('onclick', "rebuildContent('week40-reuse')");
		e.appendChild(document.createTextNode('Hide Log'));
		return e;
	}

	function isEmptyWeek(o1, o2, s1, s2, a, c) {
		return o2 === o1 && s1 === 'none' && s2 === 'none' && a === 'none' && Object.values(c).filter(x => x[0] !== 'none').length === 0;
	}

	function createDataElement(id, value, text) {
		const e = document.createElement('data');
		e.setAttribute('id', id);
		e.setAttribute('value', value);
		if (value === 'none') {
			e.appendChild(document.createTextNode('None Selected'));
		}
		else {
			e.appendChild(document.createTextNode(text));
		}
		return e;
	}

	const re = /\d$/;
	function isWeekAct(x) {
		return re.test(x[0]);
	};

	function isWeekendAct(x) {
		return !re.test(x[0]);
	};

	function createWeek(n, o1, o2, s1, s2, a, c) {
		const page = document.createElement('div');
		page.appendChild(document.createTextNode('Week ' + n + ': '));
		if (o1 !== o2) {
			page.appendChild(createDataElement('week' + n + '-outfit', o2, maps.outfit[o2].name + ', '));
		}
		page.appendChild(document.createTextNode('Morning Classes: '));
		if (s1 !== 'none') {
			page.appendChild(createDataElement('week' + n + '-morning', s1, maps.skill[s1].name));
		}
		page.appendChild(document.createTextNode(', Afternoon Classes: '));
		if (s2 !== 'none') {
			page.appendChild(createDataElement('week' + n + '-evening', s2, maps.skill[s2].name));
		}
		page.appendChild(document.createElement('br'));
		const weekActs = Object.entries(c).filter(isWeekAct);
		const weekendActs = Object.entries(c).filter(isWeekendAct);
		weekActs.forEach((x, n) => page.appendChild(createDataElement(x[0], x[1][0], (n === 0) ? x[1][1] : ', ' + x[1][1])));
		if (weekActs.length > 0) {
			page.appendChild(document.createElement('br'));
		}
		page.appendChild(document.createTextNode('Weekend: '));
		if (a !== 'none') {
			page.appendChild(createDataElement('week' + n + '-weekend', a, maps.weekend[a].name));
		}
		page.appendChild(document.createElement('br'));
		weekendActs.forEach((x, n) => page.appendChild(createDataElement(x[0], x[1][0], (n === 0) ? x[1][1] : ', ' + x[1][1])));
		if (weekendActs.length > 0) {
			page.appendChild(document.createElement('br'));
		}
		return page;
	}

	function createReport() {
		const doc = new DocumentFragment();
		let o, s1, s2, a, c, section;
		let op = 'base';

		for (let n = 1; n < 41; n++) {
			[o, s1, s2, a, c] = getSelections(n, true);
			section = (isEmptyWeek(op, o, s1, s2, a, c)) ? new DocumentFragment() : createWeek(n, op, o, s1, s2, a, c);
			doc.appendChild(section);
			op = o;
		}
		return doc;
	}

	function generateReport() {
		const doc = new DocumentFragment();
		doc.appendChild(createReport());
		doc.appendChild(createRevertButton());
		document.body.innerHTML = '';
		document.body.appendChild(doc);
	};

	return generateReport;
})();

document.addEventListener('DOMContentLoaded', () => {
	document.body.innerHTML = '';
	document.body.appendChild(generateContent(true));
	}
);

return [rebuildContent, generateReport];

})();
