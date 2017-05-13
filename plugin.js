import path from 'path';
import fs from 'fs';
import { ReportGenerator, core } from 'fulcrum';

export default class {
  async task(cli) {
    return cli.command({
      command: 'reports',
      desc: 'run the pdf reports sync for a specific organization',
      builder: {
        org: {
          desc: 'organization name',
          required: true,
          type: 'string'
        },
        form: {
          desc: 'form name',
          type: 'string'
        },
        where: {
          desc: 'sql where clause',
          type: 'string'
        },
        template: {
          desc: 'path to ejs template file',
          type: 'string'
        }
      },
      handler: this.runCommand
    });
  }

  runCommand = async () => {
    await this.activate();

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
    const templateFile = fulcrum.args.template || path.join(__dirname, 'template.ejs');

    this.template = fs.readFileSync(templateFile).toString();

    fulcrum.mkdirp('reports')
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
