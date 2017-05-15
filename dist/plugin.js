'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _fulcrumDesktopPlugin = require('fulcrum-desktop-plugin');

var _concurrentQueue = require('./concurrent-queue');

var _concurrentQueue2 = _interopRequireDefault(_concurrentQueue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

exports.default = class {
  constructor() {
    var _this = this;

    this.runCommand = _asyncToGenerator(function* () {
      yield _this.activate();

      const account = yield fulcrum.fetchAccount(fulcrum.args.org);

      if (account) {
        _this.account = account;

        const form = yield account.findFirstForm({ name: fulcrum.args.form });

        const records = yield form.findRecordsBySQL(fulcrum.args.where);

        const concurrency = Math.min(Math.max(1, fulcrum.args.concurrency || 5), 10);

        _this.queue = new _concurrentQueue2.default(_this.workerFunction, concurrency);

        for (const record of records) {
          yield record.getForm();

          _this.queue.push({ record });
        }

        yield _this.queue.drain();
      } else {
        console.error('Unable to find account', fulcrum.args.org);
      }
    });

    this.workerFunction = (() => {
      var _ref2 = _asyncToGenerator(function* (task) {
        try {
          yield _this.runReport({ record: task.record });
        } catch (err) {
          console.error('Error', err);
        }
      });

      return function (_x) {
        return _ref2.apply(this, arguments);
      };
    })();

    this.onRecordSave = (() => {
      var _ref3 = _asyncToGenerator(function* ({ record }) {
        _this.runReport({ record });
      });

      return function (_x2) {
        return _ref3.apply(this, arguments);
      };
    })();

    this.runReport = (() => {
      var _ref4 = _asyncToGenerator(function* ({ record, template, header, footer, cover }) {
        const fileName = _this.fileName === 'title' ? record.displayValue || record.id : record.id;

        const outputFileName = _path2.default.join(_this.reportPath, fileName + '.pdf');

        if (_fs2.default.existsSync(outputFileName) && _fs2.default.statSync(outputFileName).size > 0) {
          return;
        }

        const params = {
          reportName: fileName,
          directory: _this.reportPath,
          template: template || _this.template,
          header: header || _this.header,
          footer: footer || _this.footer,
          cover,
          data: {
            DateUtils: _fulcrumDesktopPlugin.core.DateUtils,
            record: record,
            renderValues: _this.renderValues,
            getPhotoURL: _this.getPhotoURL
          },
          ejsOptions: {}
        };

        yield _this.generatePDF(params);

        if (fulcrum.args.repeatables) {
          for (const item of record.formValues.repeatableItems) {
            const repeatableFileName = _this.fileName === 'title' ? `${fileName} - ${item.displayValue}` : item.id;

            params.reportName = repeatableFileName;
            params.data.record = item;

            yield _this.generatePDF(params);
          }
        }
      });

      return function (_x3) {
        return _ref4.apply(this, arguments);
      };
    })();

    this.getPhotoURL = item => {
      if (fulcrum.args.mediaPath) {
        return _path2.default.join(fulcrum.args.mediaPath, 'photos', item.mediaID + '.jpg');
      }

      const url = _fulcrumDesktopPlugin.APIClient.getPhotoURL(this.account, { id: item.mediaID }).replace('?', '/large?');

      if (url.indexOf('.jpg') === -1) {
        return url.replace('?', '.jpg?');
      }

      return url;
    };

    this.renderValues = (feature, renderFunction) => {
      return this.renderValuesRecursive(feature, feature.formValues.container.elements, renderFunction);
    };

    this.renderValuesRecursive = (feature, elements, renderFunction) => {
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
    };
  }

  task(cli) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
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
          }
        },
        handler: _this2.runCommand
      });
    })();
  }

  activate() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      const templateFile = fulcrum.args.template || _path2.default.join(__dirname, 'template.ejs');

      _this3.template = _fs2.default.readFileSync(templateFile).toString();

      if (fulcrum.args.header) {
        _this3.header = _fs2.default.readFileSync(fulcrum.args.header).toString();
      }

      if (fulcrum.args.footer) {
        _this3.footer = _fs2.default.readFileSync(fulcrum.args.footer).toString();
      }

      _this3.reportPath = fulcrum.args.reportPath || fulcrum.dir('reports');
      _this3.fileName = fulcrum.args.fileName === 'title' ? 'title' : 'id';

      _mkdirp2.default.sync(_this3.reportPath);
      // fulcrum.on('record:save', this.onRecordSave);
    })();
  }

  generatePDF(params) {
    return _asyncToGenerator(function* () {
      console.log('Generating', params.data.record.isRecord ? 'record'.green : 'child record'.green, params.reportName);
      return yield _fulcrumDesktopPlugin.ReportGenerator.generate(params);
    })();
  }

};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3BsdWdpbi5qcyJdLCJuYW1lcyI6WyJydW5Db21tYW5kIiwiYWN0aXZhdGUiLCJhY2NvdW50IiwiZnVsY3J1bSIsImZldGNoQWNjb3VudCIsImFyZ3MiLCJvcmciLCJmb3JtIiwiZmluZEZpcnN0Rm9ybSIsIm5hbWUiLCJyZWNvcmRzIiwiZmluZFJlY29yZHNCeVNRTCIsIndoZXJlIiwiY29uY3VycmVuY3kiLCJNYXRoIiwibWluIiwibWF4IiwicXVldWUiLCJ3b3JrZXJGdW5jdGlvbiIsInJlY29yZCIsImdldEZvcm0iLCJwdXNoIiwiZHJhaW4iLCJjb25zb2xlIiwiZXJyb3IiLCJ0YXNrIiwicnVuUmVwb3J0IiwiZXJyIiwib25SZWNvcmRTYXZlIiwidGVtcGxhdGUiLCJoZWFkZXIiLCJmb290ZXIiLCJjb3ZlciIsImZpbGVOYW1lIiwiZGlzcGxheVZhbHVlIiwiaWQiLCJvdXRwdXRGaWxlTmFtZSIsImpvaW4iLCJyZXBvcnRQYXRoIiwiZXhpc3RzU3luYyIsInN0YXRTeW5jIiwic2l6ZSIsInBhcmFtcyIsInJlcG9ydE5hbWUiLCJkaXJlY3RvcnkiLCJkYXRhIiwiRGF0ZVV0aWxzIiwicmVuZGVyVmFsdWVzIiwiZ2V0UGhvdG9VUkwiLCJlanNPcHRpb25zIiwiZ2VuZXJhdGVQREYiLCJyZXBlYXRhYmxlcyIsIml0ZW0iLCJmb3JtVmFsdWVzIiwicmVwZWF0YWJsZUl0ZW1zIiwicmVwZWF0YWJsZUZpbGVOYW1lIiwibWVkaWFQYXRoIiwibWVkaWFJRCIsInVybCIsInJlcGxhY2UiLCJpbmRleE9mIiwiZmVhdHVyZSIsInJlbmRlckZ1bmN0aW9uIiwicmVuZGVyVmFsdWVzUmVjdXJzaXZlIiwiY29udGFpbmVyIiwiZWxlbWVudHMiLCJlbGVtZW50IiwiZm9ybVZhbHVlIiwiZ2V0Iiwia2V5IiwiaXNTZWN0aW9uRWxlbWVudCIsImlzUmVwZWF0YWJsZUVsZW1lbnQiLCJzaG91bGRSZWN1cnNlIiwicmVjdXJzZSIsIml0ZW1zIiwiY2xpIiwiY29tbWFuZCIsImRlc2MiLCJidWlsZGVyIiwicmVxdWlyZWQiLCJ0eXBlIiwiZGVmYXVsdCIsImhhbmRsZXIiLCJ0ZW1wbGF0ZUZpbGUiLCJfX2Rpcm5hbWUiLCJyZWFkRmlsZVN5bmMiLCJ0b1N0cmluZyIsImRpciIsInN5bmMiLCJsb2ciLCJpc1JlY29yZCIsImdyZWVuIiwiZ2VuZXJhdGUiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7OztrQkFFZSxNQUFNO0FBQUE7QUFBQTs7QUFBQSxTQStEbkJBLFVBL0RtQixxQkErRE4sYUFBWTtBQUN2QixZQUFNLE1BQUtDLFFBQUwsRUFBTjs7QUFFQSxZQUFNQyxVQUFVLE1BQU1DLFFBQVFDLFlBQVIsQ0FBcUJELFFBQVFFLElBQVIsQ0FBYUMsR0FBbEMsQ0FBdEI7O0FBRUEsVUFBSUosT0FBSixFQUFhO0FBQ1gsY0FBS0EsT0FBTCxHQUFlQSxPQUFmOztBQUVBLGNBQU1LLE9BQU8sTUFBTUwsUUFBUU0sYUFBUixDQUFzQixFQUFDQyxNQUFNTixRQUFRRSxJQUFSLENBQWFFLElBQXBCLEVBQXRCLENBQW5COztBQUVBLGNBQU1HLFVBQVUsTUFBTUgsS0FBS0ksZ0JBQUwsQ0FBc0JSLFFBQVFFLElBQVIsQ0FBYU8sS0FBbkMsQ0FBdEI7O0FBRUEsY0FBTUMsY0FBY0MsS0FBS0MsR0FBTCxDQUFTRCxLQUFLRSxHQUFMLENBQVMsQ0FBVCxFQUFZYixRQUFRRSxJQUFSLENBQWFRLFdBQWIsSUFBNEIsQ0FBeEMsQ0FBVCxFQUFxRCxFQUFyRCxDQUFwQjs7QUFFQSxjQUFLSSxLQUFMLEdBQWEsOEJBQW9CLE1BQUtDLGNBQXpCLEVBQXlDTCxXQUF6QyxDQUFiOztBQUVBLGFBQUssTUFBTU0sTUFBWCxJQUFxQlQsT0FBckIsRUFBOEI7QUFDNUIsZ0JBQU1TLE9BQU9DLE9BQVAsRUFBTjs7QUFFQSxnQkFBS0gsS0FBTCxDQUFXSSxJQUFYLENBQWdCLEVBQUNGLE1BQUQsRUFBaEI7QUFDRDs7QUFFRCxjQUFNLE1BQUtG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LFFBQW5CLEdBQThCLFNBQVNDLEtBQXZDLEdBQStDLGVBQWVBLEtBQXhGLEVBQStGakQsT0FBT0MsVUFBdEc7QUFDQSxhQUFPLE1BQU0sc0NBQWdCaUQsUUFBaEIsQ0FBeUJsRCxNQUF6QixDQUFiO0FBRndCO0FBR3pCOztBQXRLa0IsQyIsImZpbGUiOiJwbHVnaW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgbWtkaXJwIGZyb20gJ21rZGlycCc7XG5pbXBvcnQgeyBSZXBvcnRHZW5lcmF0b3IsIEFQSUNsaWVudCwgY29yZSB9IGZyb20gJ2Z1bGNydW0nO1xuaW1wb3J0IENvbmN1cnJlbnRRdWV1ZSBmcm9tICcuL2NvbmN1cnJlbnQtcXVldWUnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGFzeW5jIHRhc2soY2xpKSB7XG4gICAgcmV0dXJuIGNsaS5jb21tYW5kKHtcbiAgICAgIGNvbW1hbmQ6ICdyZXBvcnRzJyxcbiAgICAgIGRlc2M6ICdydW4gdGhlIHBkZiByZXBvcnRzIHN5bmMgZm9yIGEgc3BlY2lmaWMgb3JnYW5pemF0aW9uJyxcbiAgICAgIGJ1aWxkZXI6IHtcbiAgICAgICAgb3JnOiB7XG4gICAgICAgICAgZGVzYzogJ29yZ2FuaXphdGlvbiBuYW1lJyxcbiAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBmb3JtOiB7XG4gICAgICAgICAgZGVzYzogJ2Zvcm0gbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBkZXNjOiAnc3FsIHdoZXJlIGNsYXVzZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgdGVtcGxhdGU6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byBlanMgdGVtcGxhdGUgZmlsZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgaGVhZGVyOiB7XG4gICAgICAgICAgZGVzYzogJ3BhdGggdG8gaGVhZGVyIGVqcyB0ZW1wbGF0ZSBmaWxlJyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBmb290ZXI6IHtcbiAgICAgICAgICBkZXNjOiAncGF0aCB0byBmb290ZXIgZWpzIHRlbXBsYXRlIGZpbGUnLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydFBhdGg6IHtcbiAgICAgICAgICBkZXNjOiAncmVwb3J0IHN0b3JhZ2UgZGlyZWN0b3J5JyxcbiAgICAgICAgICB0eXBlOiAnc3RyaW5nJ1xuICAgICAgICB9LFxuICAgICAgICBtZWRpYVBhdGg6IHtcbiAgICAgICAgICBkZXNjOiAnbWVkaWEgc3RvcmFnZSBkaXJlY3RvcnknLFxuICAgICAgICAgIHR5cGU6ICdzdHJpbmcnXG4gICAgICAgIH0sXG4gICAgICAgIGZpbGVOYW1lOiB7XG4gICAgICAgICAgZGVzYzogJ2ZpbGUgbmFtZScsXG4gICAgICAgICAgdHlwZTogJ3N0cmluZydcbiAgICAgICAgfSxcbiAgICAgICAgY29uY3VycmVuY3k6IHtcbiAgICAgICAgICBkZXNjOiAnY29uY3VycmVudCByZXBvcnRzIChiZXR3ZWVuIDEgYW5kIDEwKScsXG4gICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgZGVmYXVsdDogNVxuICAgICAgICB9LFxuICAgICAgICByZXBlYXRhYmxlczoge1xuICAgICAgICAgIGRlc2M6ICdnZW5lcmF0ZSBhIFBERiBmb3IgZWFjaCByZXBlYXRhYmxlIGNoaWxkIHJlY29yZCcsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgIHJlY3Vyc2U6IHtcbiAgICAgICAgICBkZXNjOiAncmVjdXJzaXZlbHkgcHJpbnQgYWxsIGNoaWxkIGl0ZW1zIGluIGVhY2ggUERGJyxcbiAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaGFuZGxlcjogdGhpcy5ydW5Db21tYW5kXG4gICAgfSk7XG4gIH1cblxuICBydW5Db21tYW5kID0gYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IHRoaXMuYWN0aXZhdGUoKTtcblxuICAgIGNvbnN0IGFjY291bnQgPSBhd2FpdCBmdWxjcnVtLmZldGNoQWNjb3VudChmdWxjcnVtLmFyZ3Mub3JnKTtcblxuICAgIGlmIChhY2NvdW50KSB7XG4gICAgICB0aGlzLmFjY291bnQgPSBhY2NvdW50O1xuXG4gICAgICBjb25zdCBmb3JtID0gYXdhaXQgYWNjb3VudC5maW5kRmlyc3RGb3JtKHtuYW1lOiBmdWxjcnVtLmFyZ3MuZm9ybX0pO1xuXG4gICAgICBjb25zdCByZWNvcmRzID0gYXdhaXQgZm9ybS5maW5kUmVjb3Jkc0J5U1FMKGZ1bGNydW0uYXJncy53aGVyZSk7XG5cbiAgICAgIGNvbnN0IGNvbmN1cnJlbmN5ID0gTWF0aC5taW4oTWF0aC5tYXgoMSwgZnVsY3J1bS5hcmdzLmNvbmN1cnJlbmN5IHx8IDUpLCAxMCk7XG5cbiAgICAgIHRoaXMucXVldWUgPSBuZXcgQ29uY3VycmVudFF1ZXVlKHRoaXMud29ya2VyRnVuY3Rpb24sIGNvbmN1cnJlbmN5KTtcblxuICAgICAgZm9yIChjb25zdCByZWNvcmQgb2YgcmVjb3Jkcykge1xuICAgICAgICBhd2FpdCByZWNvcmQuZ2V0Rm9ybSgpO1xuXG4gICAgICAgIHRoaXMucXVldWUucHVzaCh7cmVjb3JkfSk7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMucXVldWUuZHJhaW4oKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdVbmFibGUgdG8gZmluZCBhY2NvdW50JywgZnVsY3J1bS5hcmdzLm9yZyk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgYWN0aXZhdGUoKSB7XG4gICAgY29uc3QgdGVtcGxhdGVGaWxlID0gZnVsY3J1bS5hcmdzLnRlbXBsYXRlIHx8IHBhdGguam9pbihfX2Rpcm5hbWUsICd0ZW1wbGF0ZS5lanMnKTtcblxuICAgIHRoaXMudGVtcGxhdGUgPSBmcy5yZWFkRmlsZVN5bmModGVtcGxhdGVGaWxlKS50b1N0cmluZygpO1xuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5oZWFkZXIpIHtcbiAgICAgIHRoaXMuaGVhZGVyID0gZnMucmVhZEZpbGVTeW5jKGZ1bGNydW0uYXJncy5oZWFkZXIpLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKGZ1bGNydW0uYXJncy5mb290ZXIpIHtcbiAgICAgIHRoaXMuZm9vdGVyID0gZnMucmVhZEZpbGVTeW5jKGZ1bGNydW0uYXJncy5mb290ZXIpLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgdGhpcy5yZXBvcnRQYXRoID0gZnVsY3J1bS5hcmdzLnJlcG9ydFBhdGggfHwgZnVsY3J1bS5kaXIoJ3JlcG9ydHMnKTtcbiAgICB0aGlzLmZpbGVOYW1lID0gZnVsY3J1bS5hcmdzLmZpbGVOYW1lID09PSAndGl0bGUnID8gJ3RpdGxlJyA6ICdpZCc7XG5cbiAgICBta2RpcnAuc3luYyh0aGlzLnJlcG9ydFBhdGgpO1xuICAgIC8vIGZ1bGNydW0ub24oJ3JlY29yZDpzYXZlJywgdGhpcy5vblJlY29yZFNhdmUpO1xuICB9XG5cbiAgd29ya2VyRnVuY3Rpb24gPSBhc3luYyAodGFzaykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLnJ1blJlcG9ydCh7cmVjb3JkOiB0YXNrLnJlY29yZH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3InLCBlcnIpO1xuICAgIH1cbiAgfVxuXG4gIG9uUmVjb3JkU2F2ZSA9IGFzeW5jICh7cmVjb3JkfSkgPT4ge1xuICAgIHRoaXMucnVuUmVwb3J0KHtyZWNvcmR9KTtcbiAgfVxuXG4gIHJ1blJlcG9ydCA9IGFzeW5jICh7cmVjb3JkLCB0ZW1wbGF0ZSwgaGVhZGVyLCBmb290ZXIsIGNvdmVyfSkgPT4ge1xuICAgIGNvbnN0IGZpbGVOYW1lID0gdGhpcy5maWxlTmFtZSA9PT0gJ3RpdGxlJyA/IHJlY29yZC5kaXNwbGF5VmFsdWUgfHwgcmVjb3JkLmlkIDogcmVjb3JkLmlkO1xuXG4gICAgY29uc3Qgb3V0cHV0RmlsZU5hbWUgPSBwYXRoLmpvaW4odGhpcy5yZXBvcnRQYXRoLCBmaWxlTmFtZSArICcucGRmJyk7XG5cbiAgICBpZiAoZnMuZXhpc3RzU3luYyhvdXRwdXRGaWxlTmFtZSkgJiYgZnMuc3RhdFN5bmMob3V0cHV0RmlsZU5hbWUpLnNpemUgPiAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0ge1xuICAgICAgcmVwb3J0TmFtZTogZmlsZU5hbWUsXG4gICAgICBkaXJlY3Rvcnk6IHRoaXMucmVwb3J0UGF0aCxcbiAgICAgIHRlbXBsYXRlOiB0ZW1wbGF0ZSB8fCB0aGlzLnRlbXBsYXRlLFxuICAgICAgaGVhZGVyOiBoZWFkZXIgfHwgdGhpcy5oZWFkZXIsXG4gICAgICBmb290ZXI6IGZvb3RlciB8fCB0aGlzLmZvb3RlcixcbiAgICAgIGNvdmVyLFxuICAgICAgZGF0YToge1xuICAgICAgICBEYXRlVXRpbHM6IGNvcmUuRGF0ZVV0aWxzLFxuICAgICAgICByZWNvcmQ6IHJlY29yZCxcbiAgICAgICAgcmVuZGVyVmFsdWVzOiB0aGlzLnJlbmRlclZhbHVlcyxcbiAgICAgICAgZ2V0UGhvdG9VUkw6IHRoaXMuZ2V0UGhvdG9VUkxcbiAgICAgIH0sXG4gICAgICBlanNPcHRpb25zOiB7fVxuICAgIH07XG5cbiAgICBhd2FpdCB0aGlzLmdlbmVyYXRlUERGKHBhcmFtcyk7XG5cbiAgICBpZiAoZnVsY3J1bS5hcmdzLnJlcGVhdGFibGVzKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcmVjb3JkLmZvcm1WYWx1ZXMucmVwZWF0YWJsZUl0ZW1zKSB7XG4gICAgICAgIGNvbnN0IHJlcGVhdGFibGVGaWxlTmFtZSA9IHRoaXMuZmlsZU5hbWUgPT09ICd0aXRsZScgPyBgJHtmaWxlTmFtZX0gLSAke2l0ZW0uZGlzcGxheVZhbHVlfWAgOiBpdGVtLmlkO1xuXG4gICAgICAgIHBhcmFtcy5yZXBvcnROYW1lID0gcmVwZWF0YWJsZUZpbGVOYW1lO1xuICAgICAgICBwYXJhbXMuZGF0YS5yZWNvcmQgPSBpdGVtO1xuXG4gICAgICAgIGF3YWl0IHRoaXMuZ2VuZXJhdGVQREYocGFyYW1zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyBnZW5lcmF0ZVBERihwYXJhbXMpIHtcbiAgICBjb25zb2xlLmxvZygnR2VuZXJhdGluZycsIHBhcmFtcy5kYXRhLnJlY29yZC5pc1JlY29yZCA/ICdyZWNvcmQnLmdyZWVuIDogJ2NoaWxkIHJlY29yZCcuZ3JlZW4sIHBhcmFtcy5yZXBvcnROYW1lKTtcbiAgICByZXR1cm4gYXdhaXQgUmVwb3J0R2VuZXJhdG9yLmdlbmVyYXRlKHBhcmFtcyk7XG4gIH1cblxuICBnZXRQaG90b1VSTCA9IChpdGVtKSA9PiB7XG4gICAgaWYgKGZ1bGNydW0uYXJncy5tZWRpYVBhdGgpIHtcbiAgICAgIHJldHVybiBwYXRoLmpvaW4oZnVsY3J1bS5hcmdzLm1lZGlhUGF0aCwgJ3Bob3RvcycsIGl0ZW0ubWVkaWFJRCArICcuanBnJyk7XG4gICAgfVxuXG4gICAgY29uc3QgdXJsID0gQVBJQ2xpZW50LmdldFBob3RvVVJMKHRoaXMuYWNjb3VudCwge2lkOiBpdGVtLm1lZGlhSUR9KS5yZXBsYWNlKCc/JywgJy9sYXJnZT8nKTtcblxuICAgIGlmICh1cmwuaW5kZXhPZignLmpwZycpID09PSAtMSkge1xuICAgICAgcmV0dXJuIHVybC5yZXBsYWNlKCc/JywgJy5qcGc/Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHVybDtcbiAgfVxuXG4gIHJlbmRlclZhbHVlcyA9IChmZWF0dXJlLCByZW5kZXJGdW5jdGlvbikgPT4ge1xuICAgIHJldHVybiB0aGlzLnJlbmRlclZhbHVlc1JlY3Vyc2l2ZShmZWF0dXJlLCBmZWF0dXJlLmZvcm1WYWx1ZXMuY29udGFpbmVyLmVsZW1lbnRzLCByZW5kZXJGdW5jdGlvbik7XG4gIH1cblxuICByZW5kZXJWYWx1ZXNSZWN1cnNpdmUgPSAoZmVhdHVyZSwgZWxlbWVudHMsIHJlbmRlckZ1bmN0aW9uKSA9PiB7XG4gICAgZm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG4gICAgICBjb25zdCBmb3JtVmFsdWUgPSBmZWF0dXJlLmZvcm1WYWx1ZXMuZ2V0KGVsZW1lbnQua2V5KTtcblxuICAgICAgcmVuZGVyRnVuY3Rpb24oZWxlbWVudCwgZm9ybVZhbHVlKTtcblxuICAgICAgaWYgKGVsZW1lbnQuaXNTZWN0aW9uRWxlbWVudCkge1xuICAgICAgICB0aGlzLnJlbmRlclZhbHVlc1JlY3Vyc2l2ZShmZWF0dXJlLCBlbGVtZW50LmVsZW1lbnRzLCByZW5kZXJGdW5jdGlvbik7XG4gICAgICB9IGVsc2UgaWYgKGVsZW1lbnQuaXNSZXBlYXRhYmxlRWxlbWVudCkge1xuICAgICAgICBsZXQgc2hvdWxkUmVjdXJzZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKGVsZW1lbnQuaXNSZXBlYXRhYmxlRWxlbWVudCAmJiBmdWxjcnVtLmFyZ3MucmVjdXJzZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBzaG91bGRSZWN1cnNlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZm9ybVZhbHVlICYmIHNob3VsZFJlY3Vyc2UpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgZm9ybVZhbHVlLml0ZW1zKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclZhbHVlc1JlY3Vyc2l2ZShpdGVtLCBlbGVtZW50LmVsZW1lbnRzLCByZW5kZXJGdW5jdGlvbik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXX0=