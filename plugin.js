import Plugin from 'fulcrum-sync-plugin';
import path from 'path';
import fs from 'fs';

export default class ReportPlugin extends Plugin {
  // return true to enable this plugin
  get enabled() {
    return false;
  }

  async runTask({app, yargs}) {
    const args =
      yargs.usage('Usage: reports --org [org]')
        .demandOption([ 'org' ])
        .argv;

    const account = await app.fetchAccount(args.org);

    if (account) {
      const form = await account.findFirstForm({name: 'GeoBooze'});

      const records = await form.findRecordsBySQL("beer_type_value = 'Amber Ale'");

      for (const record of records) {
        await record.getForm();

        console.log('running', record.displayValue);

        await this.runReport({record});
      }
    } else {
      console.error('Unable to find account', args.org);
    }
  }

  async initialize({app}) {
    this.template = fs.readFileSync(path.join(__dirname, 'template.ejs')).toString();
    this.ReportGenerator = app.api.ReportGenerator;
    this.app = app;
    // app.on('record:save', this.onRecordSave);
  }

  onRecordSave = async ({record}) => {
    this.runReport({record});
  }

  runReport = async ({record, template, header, footer, cover}) => {
    const params = {
      reportName: record.displayValue || record.id,
      directory: this.app.dir('reports'),
      template: template || this.template,
      header,
      footer,
      cover,
      data: {
        DateUtils: this.app.api.core.DateUtils,
        record: record,
        renderValues: this.renderValues
      },
      ejsOptions: {}
    };

    await this.ReportGenerator.generate(params);
  }

  renderValues = (feature, renderFunction) => {
    for (const element of feature.formValues.container.elements) {
      const formValue = feature.formValues.get(element.key);

      if (formValue) {
        renderFunction(element, formValue);
      }
    }
  }
}
