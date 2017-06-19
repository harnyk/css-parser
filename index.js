const fs = require('q-io/fs');
const css = require('css');
const path = require('path');
const csvStringify = require('csv-stringify-as-promised');

const maybeSome = (items = [], fn) => items.some(fn);

const RE_BACKGROUND_SELECTOR = /color\-\d\-background/i;
const RE_COLOR_SELECTOR = /color\-\d[^\-]/i;

const isBackgroundSelector = selector => RE_BACKGROUND_SELECTOR.test(selector);

const isColorSelector = selector => RE_COLOR_SELECTOR.test(selector);

const isBackgroundImageDeclaration = declaration =>
    declaration.property.startsWith('background') &&
    declaration.value.startsWith('url');

const containsBackgroundSelectors = rule =>
    maybeSome(rule.selectors, isBackgroundSelector);

const containsColorSelectors = rule =>
    maybeSome(rule.selectors, isColorSelector);

const containsBackgroundImageDeclarations = rule =>
    maybeSome(rule.declarations, isBackgroundImageDeclaration);

const INITIAL_STAT = {
    eventId: 0,
    length: 0,
    emptyStylesheet: 0,
    backgroundSelectors: 0,
    colorSelectors: 0,
    backgroundIsOverriddenWithImage: 0,
    error: 0,
    digest: '',
    errorStack: ''
};

const getStatistics = (initStat, ast) => {
    if (!ast.stylesheet.rules) {
        return Object.assign({}, initStat, { emptyStylesheet: 1 });
    }
    return ast.stylesheet.rules.reduce((stat, rule) => {
        if (containsBackgroundSelectors(rule)) {
            stat.backgroundSelectors++;
            if (containsBackgroundImageDeclarations(rule)) {
                stat.backgroundIsOverriddenWithImage++;
            }
        }
        if (containsColorSelectors(rule)) {
            stat.colorSelectors++;
        }

        return stat;
    }, Object.assign({}, initStat));
};

const getInitStat = (eventId, length) => {
    return Object.assign({}, INITIAL_STAT, {
        eventId,
        length
    });
};

const main = async () => {
    const dir = path.join(__dirname, 'css');
    const files = await fs.list(dir);
    const stats = await Promise.all(
        files.map(async file => {
            const eventId = file.match(/^\d+/)[0];
            const filePath = path.join(dir, file);
            const fileContents = await fs.read(filePath);
            const length = fileContents.length;
            const initStat = getInitStat(eventId, length);
            console.warn(
                `eventId=${eventId}, file=${file}: read ${length} characters`
            );

            try {
                const ast = css.parse(fileContents, { source: filePath });
                const stats = getStatistics(initStat, ast);
                return stats;
            } catch (e) {
                console.warn(
                    `Illegal CSS: ${JSON.stringify(
                        fileContents.substr(0, 50)
                    )}... ${e.stack}`
                );
                return Object.assign({}, initStat, {
                    error: 1,
                    digest: fileContents.substr(0, 50),
                    errorStack: e.stack.toString()
                });
            }
        })
    );

    console.log(await csvStringify(stats, { header: true }));
};

main();
