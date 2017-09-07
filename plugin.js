import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import { ReportGenerator, APIClient, core } from 'fulcrum';
import ConcurrentQueue from './concurrent-queue';

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
          type: 'array'
        },
        skip: {
          desc: 'skip form name',
          type: 'array'
        },
        template: {
          desc: 'path to ejs template file',
          type: 'string'
        },
        header: {
          desc: 'path to header ejs template file',
          type: 'string'
        },
        footer: {
          desc: 'path to footer ejs template file',
          type: 'string'
        },
        reportPath: {
          desc: 'report storage directory',
          type: 'string'
        },
        mediaPath: {
          desc: 'media storage directory',
          type: 'string'
        },
        fileName: {
          desc: 'file name',
          type: 'string'
        },
        concurrency: {
          desc: 'concurrent reports (between 1 and 10)',
          type: 'number',
          default: 5
        },
        repeatables: {
          desc: 'generate a PDF for each repeatable child record',
          type: 'boolean',
          default: false
        },
        recurse: {
          desc: 'recursively print all child items in each PDF',
          type: 'boolean',
          default: true
        },
        wkhtmltopdf: {
          desc: 'path to wkhtmltopdf binary',
          type: 'string'
        }
      },
      handler: this.runCommand
    });
  }

  runCommand = async () => {
    await this.activate();

    const account = await fulcrum.fetchAccount(fulcrum.args.org);

    const skipForms = fulcrum.args.skip || [];
    const includeForms = fulcrum.args.form != null ? fulcrum.args.form : null;

    if (account) {
      this.account = account;

      const forms = await account.findForms({});

      const concurrency = Math.min(Math.max(1, fulcrum.args.concurrency || 5), 50);

      this.queue = new ConcurrentQueue(this.workerFunction, concurrency);

      for (const form of forms) {
        if (skipForms.indexOf(form.name) > -1) {
          continue;
        }

        if (includeForms && includeForms.indexOf(form.name) === -1) {
          continue;
        }

        await form.findEachRecord({}, async (record) => {
          this.queue.push({id: record.rowID});
        });
      }

      await this.queue.drain();

    } else {
      console.error('Unable to find account', fulcrum.args.org);
    }
  }

  async activate() {
    const templateFile = fulcrum.args.template || path.join(__dirname, 'template.ejs');

    this.template = fs.readFileSync(templateFile).toString();

    if (fulcrum.args.header) {
      this.header = fs.readFileSync(fulcrum.args.header).toString();
    }

    if (fulcrum.args.footer) {
      this.footer = fs.readFileSync(fulcrum.args.footer).toString();
    }

    this.reportPath = fulcrum.args.reportPath || fulcrum.dir('reports');
    this.fileName = fulcrum.args.fileName === 'title' ? 'title' : 'id';

    mkdirp.sync(this.reportPath);
    // fulcrum.on('record:save', this.onRecordSave);
  }

  workerFunction = async (task) => {
    try {
      const record = await this.account.findFirstRecord({id: task.id});

      await record.getForm();

      await this.runReport({record});
    } catch (err) {
      console.error('Error', err);
    }
  }

  onRecordSave = async ({record}) => {
    this.runReport({record});
  }

  runReport = async ({record, template, header, footer, cover}) => {
    const fileName = this.fileName === 'title' ? record.displayValue || record.id : record.id;

    const outputFileName = path.join(this.reportPath, fileName + '.pdf');

    if (fs.existsSync(outputFileName) && fs.statSync(outputFileName).size > 0) {
      return;
    }

    const params = {
      reportName: fileName,
      directory: this.reportPath,
      template: template || this.template,
      header: header || this.header,
      footer: footer || this.footer,
      cover,
      data: {
        DateUtils: core.DateUtils,
        record: record,
        renderValues: this.renderValues,
        getPhotoURL: this.getPhotoURL
      },
      ejsOptions: {},
      reportOptions: {
        wkhtmltopdf: fulcrum.args.wkhtmltopdf
      }
    };

    await this.generatePDF(params);

    if (fulcrum.args.repeatables) {
      for (const item of record.formValues.repeatableItems) {
        const repeatableFileName = this.fileName === 'title' ? `${fileName} - ${item.displayValue}` : item.id;

        params.reportName = repeatableFileName;
        params.data.record = item;

        await this.generatePDF(params);
      }
    }
  }

  async generatePDF(params) {
    console.log('Generating', params.data.record.isRecord ? 'record'.green : 'child record'.green, params.reportName);
    return await ReportGenerator.generate(params);
  }

  getPhotoURL = (item) => {
    if (fulcrum.args.mediaPath) {
      return path.join(fulcrum.args.mediaPath, 'photos', item.mediaID + '.jpg');
    }

    const url = APIClient.getPhotoURL(this.account, {id: item.mediaID}).replace('?', '/large?');

    if (url.indexOf('.jpg') === -1) {
      return url.replace('?', '.jpg?');
    }

    return url;
  }

  renderValues = (feature, renderFunction) => {
    return this.renderValuesRecursive(feature, feature.formValues.container.elements, renderFunction);
  }

  renderValuesRecursive = (feature, elements, renderFunction) => {
    for (const element of elements) {
      const formValue = feature.formValues.get(element.key);

      renderFunction(element, formValue);

      if (element.isSectionElement) {
        this.renderValuesRecursive(feature, element.elements, renderFunction);
      } else if (element.isRepeatableElement) {
        let shouldRecurse = true;

        if (element.isRepeatableElement && fulcrum.args.recurse === false) {
          shouldRecurse = false;
        }

        if (formValue && shouldRecurse) {
          for (const item of formValue.items) {
            this.renderValuesRecursive(item, element.elements, renderFunction);
          }
        }
      }
    }
  }
}
