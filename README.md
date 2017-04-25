## Fulcrum Sync Reports

Generate custom PDF reports from Fulcrum data.

### Installation

```sh
./run install-plugin --git https://github.com/fulcrumapp/fulcrum-sync-reports
```

### Run reports

```
./run task reports --org 'Fulcrum Account Name' --form 'GeoBooze' --where "beer_type_value = 'Amber Ale'" --template custom.ejs
```

### Keep reports in sync

```
./run sync --org 'Fulcrum Account Name'
```

### Customize

Edit `template.ejs`
