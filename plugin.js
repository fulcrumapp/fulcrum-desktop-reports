import Plugin from '../../src/plugin';
import Generator from '../../src/reports/generator';
import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs';
import { DateUtils } from 'fulcrum-core';

const REPORT_PATH = path.join('.', 'reports');

export default class ReportPlugin extends Plugin {
  // return true to enable this plugin
  get enabled() {
    return false;
  }

  async runTask({app, yargs}) {
    this.args = yargs.usage('Usage: reports --org [org]')
      .demandOption([ 'org' ])
      .argv;

    const account = await this.fetchAccount(this.args.org);

    if (account) {
      const form = await account.findFirstForm({name: 'GeoBooze'});

      const records = await form.findRecordsBySQL("beer_type_value = 'Amber Ale'");

      for (const record of records) {
        await record.getForm();
        console.log('running', record.displayValue);
        await this.runReport({record});
      }
    } else {
      console.error('Unable to find account', this.args.org);
    }
  }

  async initialize({app}) {
    this.template = fs.readFileSync(path.join(__dirname, 'template.ejs')).toString();

    mkdirp.sync(REPORT_PATH);

    // app.on('record:save', this.onRecordSave);
  }

  onRecordSave = async ({record}) => {
    this.runReport({record});
  }

  runReport = async ({record, template, header, footer, cover}) => {
    const params = {
      reportName: record.displayValue || record.id,
      directory: REPORT_PATH,
      template: template || this.template,
      header,
      footer,
      cover,
      data: {
        DateUtils: DateUtils,
        record: record,
        renderValues: this.renderValues
      },
      ejsOptions: {}
    };

    await Generator.generate(params);
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
