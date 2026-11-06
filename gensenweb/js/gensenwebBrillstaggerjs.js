/*
termextract-brillstaggerjs
POStagger Brills Taggerをベースとした英語の専門用語自動抽出システム

Copyright
「専門用語自動抽出システム」は 東京大学情報基盤センター図書館電子化部門中川裕志教授および横浜国立大学環境情報研究院森辰則助教授が共同で開発したものです。
termextract-brillstaggerjsは、このシステムをベースにしたNode.js版TermExtractから移植しています。
*/
(function (global) {
    const IGNORE_WORDS = new Set(["of", "Of", "OF"]);

    function cmp_noun_list(data) {
        const cmpNouns = [];
        let status = 0;
        let rest = 0;
        let seg = [];

        for (const morph of data.taggedWords) {
            let term = morph.token;
            const tag = morph.tag;

            if (/[\s+%&$*#^|\[\]-]$/.test(term) || /\d+$/.test(term)) {
                increase(cmpNouns, seg, rest);
                seg = [];
                continue;
            }

            if (/NN[PS]?$/.test(tag) || tag === "NNPS") {
                if (tag === "NNS") {
                    term = stemming(term);
                }
                if (/NNS?$/.test(tag) && /^[A-Z][a-z]/.test(term)) {
                    term = term[0].toLowerCase() + term.substring(1);
                }
                status = 1;
                seg.push(term);
                rest = 0;
            } else if (tag === "JJ") {
                if (status === 0 || status === 2 || status === 3 || status === 5) {
                    seg.push(term);
                    rest += 1;
                } else {
                    increase(cmpNouns, seg, rest);
                    seg = [term];
                    rest += 1;
                }
                status = 2;
            } else if (tag === "POS") {
                if (status === 1) {
                    status = 3;
                    seg.push(term);
                    rest += 1;
                } else {
                    increase(cmpNouns, seg, rest);
                    seg = [];
                }
            } else if (term === "of" && tag === "IN") {
                if (status === 1) {
                    status = 4;
                    seg.push(term);
                    rest += 1;
                } else {
                    increase(cmpNouns, seg, rest);
                    seg = [];
                    status = 0;
                }
            } else if (tag === "CD") {
                increase(cmpNouns, seg, rest);
                seg = [term];
                status = 5;
            } else if (tag === "VBN") {
                increase(cmpNouns, seg, rest);
                seg = [term];
                status = 6;
                rest += 1;
            } else if (tag === "FW") {
                increase(cmpNouns, seg, rest);
                status = 7;
                seg = [term];
            } else {
                increase(cmpNouns, seg, rest);
                seg = [];
                status = 0;
            }
        }

        increase(cmpNouns, seg, rest);
        return cmpNouns;
    }

    function stemming(noun) {
        if (/ies$/.test(noun) && !/[ae]ies$/.test(noun)) {
            return noun.replace(/ies$/, "y");
        }
        if (/es$/.test(noun) && !/[aeo]es$/.test(noun)) {
            return noun.replace(/es$/, "e");
        }
        if (/s$/.test(noun) && !/[us]s/.test(noun)) {
            return noun.replace(/s$/, "");
        }
        return noun;
    }

    function increase(cmpNouns, seg, rest) {
        const pos = seg.length - rest;
        const words = pos > 0 ? seg.slice(0, pos) : seg;
        if (words.length > 0) {
            cmpNouns.push(words.map(word => word.replace(/^\s+/, "")).join(" ")
                .replace(/,$/, "").replace(/\.$/, ""));
        }
    }

    function list2key_value(listData) {
        const keyValue = {};
        for (const data of listData) {
            keyValue[data] = (keyValue[data] || 0) + 1;
        }
        return keyValue;
    }

    function score_lr(frequency, ignoreWords = IGNORE_WORDS, averageRate = 1, lrMode = 1) {
        const stat = {};
        for (const cmpNoun of Object.keys(frequency)) {
            const nouns = cmpNoun.split(" ").filter(noun =>
                !(ignoreWords.has(noun) || /^\d[\d.,]*$/.test(noun))
            );
            for (let i = 0; i < nouns.length - 1; i++) {
                stat[nouns[i]] = stat[nouns[i]] || [0, 0];
                stat[nouns[i + 1]] = stat[nouns[i + 1]] || [0, 0];
                const count = lrMode === 2 ? 1 : frequency[cmpNoun];
                stat[nouns[i]][0] += count;
                stat[nouns[i + 1]][1] += count;
            }
        }

        const importance = {};
        for (const cmpNoun of Object.keys(frequency)) {
            const nouns = cmpNoun.split(" ").filter(noun =>
                !/^\d[\d.,]*$/.test(noun)
            );
            const score = nouns.reduce((value, noun) => {
                const sides = stat[noun] || [0, 0];
                return value * (sides[0] + 1) * (sides[1] + 1);
            }, 1);
            importance[cmpNoun] = score ** (1 / (2 * averageRate * Math.max(nouns.length, 1)));
        }
        return importance;
    }

    function term_importance(...dictionaries) {
        const importance = {};
        for (const dictionary of dictionaries) {
            for (const noun of Object.keys(dictionary)) {
                importance[noun] = (importance[noun] || 1) * dictionary[noun];
            }
        }
        return importance;
    }

    function sort_by_importance(keyValue) {
        return Object.keys(keyValue)
            .map(noun => ({ cmp_noun: noun, importance: keyValue[noun] }))
            .sort((a, b) => b.importance - a.importance);
    }

    function modify_agglutinative_lang(data) {
        return data.split(" ").reduce((display, noun, index, nouns) => {
            if (index > 0 && /^[A-Za-z]+$/.test(noun) && /^[A-Za-z]+$/.test(nouns[index - 1])) {
                return `${display} ${noun}`;
            }
            return display + noun;
        }, "");
    }

    global.gensenwebBrillstaggerjs = {
        IGNORE_WORDS,
        cmp_noun_list,
        list2key_value,
        score_lr,
        term_importance,
        sort_by_importance,
        modify_agglutinative_lang
    };
})(window);
