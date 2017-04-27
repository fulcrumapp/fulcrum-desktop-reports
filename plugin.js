import path from 'path';
import fs from 'fs';
import { ReportGenerator, core } from 'fulcrum';

export default class {
  async task() {
    fulcrum.yargs.usage('Usage: reports --org [org] --form [form name] --where [where clause] --template [template file]')
      .demandOption([ 'org', 'form' ])
      .argv;

    const account = await fulcrum.fetchAccount(fulcrum.args.org);

    if (account) {
      const form = await account.findFirstForm({name: fulcrum.args.form});

      const records = await form.findRecordsBySQL(fulcrum.args.where);

      for (const record of records) {
        await record.getForm();

        console.log('running', record.displayValue);

        await this.runReport({record});
      }
    } else {
      console.error('Unable to find account', fulcrum.args.org);
    }
  }

  async activate() {
    const templateFile = fulcrum.args.template || 'template.ejs';

    this.template = fs.readFileSync(path.join(__dirname, templateFile)).toString();

    // fulcrum.on('record:save', this.onRecordSave);
  }

  onRecordSave = async ({record}) => {
    this.runReport({record});
  }

  runReport = async ({record, template, header, footer, cover}) => {
    const params = {
      reportName: record.displayValue || record.id,
      directory: fulcrum.dir('reports'),
      template: template || this.template,
      header,
      footer,
      cover,
      data: {
        DateUtils: core.DateUtils,
        record: record,
        renderValues: this.renderValues
      },
      ejsOptions: {}
    };

    await ReportGenerator.generate(params);
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
