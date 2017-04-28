## Fulcrum Sync Reports

Generate custom PDF reports from Fulcrum data.

### Installation

```sh
fulcrum install-plugin --url https://github.com/fulcrumapp/fulcrum-sync-reports
```

### Run reports

```
fulcrum reports --org 'Fulcrum Account Name' --form 'GeoBooze' --where "beer_type_value = 'Amber Ale'" --template custom.ejs
```

### Keep reports in sync

```
fulcrum sync --org 'Fulcrum Account Name'
```

### Customize

Edit `template.ejs` or use `--template file.ejs`
