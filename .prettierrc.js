module.exports = {
    semi: true,
    singleQuote: true,
    printWidth: 120,
    tabWidth: 2,
    trailingComma: 'none',
    overrides: [
        {
            files: ['*.yml', '*.yaml'],
            options: {
                tabWidth: 2
            }
        }
    ]
};
