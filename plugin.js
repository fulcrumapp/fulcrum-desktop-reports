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
        reportsSkip: {
          desc: 'skip form name',
          type: 'array'
        },
        reportsTemplate: {
          desc: 'path to ejs template file',
          type: 'string'
        },
        reportsHeader: {
          desc: 'path to header ejs template file',
          type: 'string'
        },
        reportsFooter: {
          desc: 'path to footer ejs template file',
          type: 'string'
        },
        reportsPath: {
          desc: 'report storage directory',
          type: 'string'
        },
        reportsMediaPath: {
          desc: 'media storage directory',
          type: 'string'
        },
        reportsFileName: {
          desc: 'file name',
          type: 'string'
        },
        reportsConcurrency: {
          desc: 'concurrent reports (between 1 and 10)',
          type: 'number',
          default: 5
        },
        reportsRepeatables: {
          desc: 'generate a PDF for each repeatable child record',
          type: 'boolean',
          default: false
        },
        reportsRecurse: {
          desc: 'recursively print all child items in each PDF',
          type: 'boolean',
          default: true
        },
        reportsWkhtmltopdf: {
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

    const skipForms = fulcrum.args.reportsSkip || [];
    const includeForms = fulcrum.args.form != null ? fulcrum.args.form : null;

    if (account) {
      this.account = account;

      const forms = await account.findForms({});

      const concurrency = Math.min(Math.max(1, fulcrum.args.reportsConcurrency || 5), 50);

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
    const templateFile = fulcrum.args.reportsTemplate || path.join(__dirname, 'template.ejs');

    this.template = fs.readFileSync(templateFile).toString();

    if (fulcrum.args.reportsHeader) {
      this.header = fs.readFileSync(fulcrum.args.reportsHeader).toString();
    }

    if (fulcrum.args.reportsFooter) {
      this.footer = fs.readFileSync(fulcrum.args.reportsFooter).toString();
    }

    this.reportsPath = fulcrum.args.reportsPath || fulcrum.dir('reports');
    this.reportsFileName = fulcrum.args.reportsFileName === 'title' ? 'title' : 'id';

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
    const fileName = this.reportsFileName === 'title' ? record.displayValue || record.id : record.id;

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
        wkhtmltopdf: fulcrum.args.reportsWkhtmltopdf
      }
    };

    await this.generatePDF(params);

    if (fulcrum.args.reportsRepeatables) {
      for (const item of record.formValues.repeatableItems) {
        const repeatableFileName = this.reportsFileName === 'title' ? `${fileName} - ${item.displayValue}` : item.id;

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
    if (fulcrum.args.reportsMediaPath) {
      return path.join(fulcrum.args.reportsMediaPath, 'photos', item.mediaID + '.jpg');
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

        if (element.isRepeatableElement && fulcrum.args.reportsRecurse === false) {
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
