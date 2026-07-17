(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const state = {
    report: null,
    unknownStatusClasses: new Map()
  };

  const REPORTS = {
    cartons_consumed: {
      label: 'Cartons Consumed',
      expectedSheet: 'Cartons Consumed',
      required: [
        'QR Code',
        'Book Title',
        'BAV Code',
        'Qty',
        'Consumed On',
        'Consumed By',
        'Last Location'
      ],
      aliases: {
        'Book Name': 'Book Title',
        Quantity: 'Qty',
        'Consumed Date': 'Consumed On',
        User: 'Consumed By'
      },
      columns: [
        'QR Code',
        'Book Title',
        'BAV Code',
        'Qty',
        'Consumed By',
        'Consumed On',
        'Last Location'
      ],
      dateColumn: 'Consumed On',
      bookColumn: 'Book Title',
      bavColumn: 'BAV Code',
      cartonColumn: 'QR Code',
      countColumn: 'Qty'
    },

    cartons_created: {
      label: 'Cartons Created',
      expectedSheet: 'Cartons Created',
      required: [
        'Date Created',
        'QR Code',
        'Book Name',
        'BAV Code',
        'Qty per Carton',
        'Initial Location',
        'Created By',
        'Status',
        'Current Location'
      ],
      aliases: {
        'Book Title': 'Book Name',
        'Quantity per Carton': 'Qty per Carton'
      },
      columns: [
        'Date Created',
        'QR Code',
        'Book Name',
        'BAV Code',
        'Edition',
        'Impression',
        'Qty per Carton',
        'Initial Location',
        'Created By',
        'Status',
        'Current Location',
        'Audited'
      ],
      dateColumn: 'Date Created',
      bookColumn: 'Book Name',
      bavColumn: 'BAV Code',
      cartonColumn: 'QR Code',
      countColumn: 'Qty per Carton',
      highlightCreatedStatus: true
    },

    challan_movement: {
      label: 'Challan Movement',
      expectedSheet: 'Challan Movement',
      required: [
        'Challan No',
        'Challan Date',
        'From',
        'To',
        'Created By',
        'Carton No',
        'Book Name',
        'BAV Code',
        'Qty',
        'Status'
      ],
      aliases: {
        'Challan Number': 'Challan No',
        'Carton Number': 'Carton No',
        'Book Title': 'Book Name'
      },
      columns: [
        'Challan No',
        'Challan Date',
        'From',
        'To',
        'Created By',
        'Carton No',
        'Book Name',
        'BAV Code',
        'Qty',
        'Status',
        'Received At',
        'Received By'
      ],
      dateColumn: 'Challan Date',
      bookColumn: 'Book Name',
      bavColumn: 'BAV Code',
      cartonColumn: 'Carton No',
      countColumn: 'Qty'
    },

    carton_movements: {
      label: 'Carton Movements',
      expectedSheet: 'Carton Movements',
      required: [
        'QR Code',
        'Book Name',
        'BAV Code',
        'Move #',
        'Type',
        'Location',
        'Scanned At',
        'Scanned By'
      ],
      aliases: {
        'Book Title': 'Book Name',
        'Move No': 'Move #',
        'Move Number': 'Move #',
        'Movement No': 'Move #',
        'Movement Number': 'Move #',
        'Challan Number': 'Challan No'
      },
      columns: [
        'QR Code',
        'Book Name',
        'BAV Code',
        'Move #',
        'Type',
        'Location',
        'Scanned At',
        'Scanned By',
        'Challan No'
      ],
      dateColumn: 'Scanned At',
      bookColumn: 'Book Name',
      bavColumn: 'BAV Code',
      cartonColumn: 'QR Code',
      pivotMovements: true
    }
  };

  const PDF_HEADER_PEACH = [255, 226, 202];

  const PDF_AUDITED_YES = [221, 242, 218];
  const PDF_AUDITED_NO = [255, 224, 224];

  const PDF_STATUS_ACTIVE = [220, 238, 255];
  const PDF_STATUS_CONSUMED = [255, 229, 191];
  const PDF_STATUS_CANCELLED = [230, 215, 243];

  const PDF_STATUS_EXTRA_COLORS = [
    [223, 241, 236],
    [255, 240, 189],
    [220, 223, 247],
    [242, 217, 230],
    [217, 237, 245],
    [232, 224, 207]
  ];

  const PDF_MOVE_TEXT_COLORS = [
    [23, 63, 112],
    [111, 32, 54],
    [23, 92, 58],
    [91, 52, 119],
    [138, 72, 31],
    [36, 95, 104],
    [109, 82, 32],
    [75, 79, 143]
  ];

  function escapeHtml(value) {
    return String(value ?? '').replace(
      /[&<>'"]/g,
      (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[character]
    );
  }

  function normalizeText(value) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function isBlank(value) {
    if (value == null) {
      return true;
    }

    const text = String(value)
      .trim()
      .toLowerCase();

    return [
      '',
      '-',
      '--',
      '—',
      '–',
      'n/a',
      'na',
      'null',
      'none'
    ].includes(text);
  }

  function normalizeCode(value) {
    if (isBlank(value)) {
      return '';
    }

    return String(value)
      .toUpperCase()
      .replace(/\s+/g, '')
      .trim();
  }

  function getUnknownStatusIndex(value) {
    const normalized = normalizeText(value);

    if (!normalized) {
      return 0;
    }

    if (!state.unknownStatusClasses.has(normalized)) {
      const nextIndex =
        state.unknownStatusClasses.size %
        PDF_STATUS_EXTRA_COLORS.length;

      state.unknownStatusClasses.set(
        normalized,
        nextIndex
      );
    }

    return state.unknownStatusClasses.get(normalized);
  }

  function getCreatedCellClass(column, value) {
    const normalized = normalizeText(value);

    if (column === 'Audited') {
      if (normalized === 'yes') {
        return 'audited-yes';
      }

      if (normalized === 'no') {
        return 'audited-no';
      }
    }

    if (column === 'Status') {
      if (normalized === 'active') {
        return 'status-active';
      }

      if (normalized === 'consumed') {
        return 'status-consumed';
      }

      if (
        normalized === 'cancelled' ||
        normalized === 'canceled'
      ) {
        return 'status-cancelled';
      }

      if (normalized) {
        return `status-extra-${
          getUnknownStatusIndex(normalized) + 1
        }`;
      }
    }

    return '';
  }

  function getCreatedPdfColor(column, value) {
    const normalized = normalizeText(value);

    if (column === 'Audited') {
      if (normalized === 'yes') {
        return PDF_AUDITED_YES;
      }

      if (normalized === 'no') {
        return PDF_AUDITED_NO;
      }

      return null;
    }

    if (column === 'Status') {
      if (normalized === 'active') {
        return PDF_STATUS_ACTIVE;
      }

      if (normalized === 'consumed') {
        return PDF_STATUS_CONSUMED;
      }

      if (
        normalized === 'cancelled' ||
        normalized === 'canceled'
      ) {
        return PDF_STATUS_CANCELLED;
      }

      if (normalized) {
        return PDF_STATUS_EXTRA_COLORS[
          getUnknownStatusIndex(normalized)
        ];
      }
    }

    return null;
  }

  function getMoveColorIndex(index) {
    return index % PDF_MOVE_TEXT_COLORS.length;
  }

  function levenshtein(a, b) {
    const matrix = Array.from(
      { length: a.length + 1 },
      () => Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i += 1) {
      matrix[i][0] = i;
    }

    for (let j = 0; j <= b.length; j += 1) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] +
            (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }

    return matrix[a.length][b.length];
  }

  function similarity(a, b) {
    const left = normalizeText(a);
    const right = normalizeText(b);

    if (!left && !right) {
      return 1;
    }

    return 1 - (
      levenshtein(left, right) /
      Math.max(left.length, right.length, 1)
    );
  }

  function chooseSheet(sheetNames, expectedName, isCsv) {
    if (isCsv) {
      return {
        sheet: sheetNames[0],
        exact: true
      };
    }

    const exact = sheetNames.find(
      (name) =>
        normalizeText(name) === normalizeText(expectedName)
    );

    if (exact) {
      return {
        sheet: exact,
        exact: true
      };
    }

    const ranked = sheetNames
      .map((sheet) => ({
        sheet,
        score: similarity(sheet, expectedName)
      }))
      .sort((a, b) => b.score - a.score);

    if (ranked[0] && ranked[0].score >= 0.68) {
      return {
        ...ranked[0],
        exact: false
      };
    }

    if (sheetNames.length === 1) {
      return {
        sheet: sheetNames[0],
        exact: false
      };
    }

    throw new Error(
      `Could not find a worksheet close to “${expectedName}”. ` +
      `Available sheets: ${sheetNames.join(', ')}`
    );
  }

  function canonicalHeader(header, definition) {
    const trimmed = String(header ?? '').trim();

    if (definition.aliases[trimmed]) {
      return definition.aliases[trimmed];
    }

    const known = [
      ...definition.required,
      ...definition.columns,
      ...Object.keys(definition.aliases)
    ];

    const exactKnown = known.find(
      (candidate) =>
        normalizeText(candidate) === normalizeText(trimmed)
    );

    if (!exactKnown) {
      return trimmed;
    }

    return definition.aliases[exactKnown] || exactKnown;
  }

  function parseDate(value) {
    if (value == null || value === '') {
      return null;
    }

    if (
      value instanceof Date &&
      !Number.isNaN(value.getTime())
    ) {
      return value;
    }

    if (
      typeof value === 'number' &&
      window.XLSX?.SSF
    ) {
      const parts = XLSX.SSF.parse_date_code(value);

      if (parts) {
        return new Date(
          parts.y,
          parts.m - 1,
          parts.d,
          parts.H,
          parts.M,
          Math.floor(parts.S)
        );
      }
    }

    const text = String(value).trim();

    const normalDate = new Date(
      text.replace(',', ' ')
    );

    if (!Number.isNaN(normalDate.getTime())) {
      return normalDate;
    }

    const match = text.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
    );

    if (!match) {
      return null;
    }

    let [
      ,
      day,
      month,
      year,
      hour = '0',
      minute = '0',
      second = '0',
      meridiem
    ] = match;

    year = Number(year);
    hour = Number(hour);

    if (year < 100) {
      year += 2000;
    }

    if (meridiem) {
      const upper = meridiem.toUpperCase();

      if (upper === 'PM' && hour < 12) {
        hour += 12;
      }

      if (upper === 'AM' && hour === 12) {
        hour = 0;
      }
    }

    const parsed = new Date(
      year,
      Number(month) - 1,
      Number(day),
      hour,
      Number(minute),
      Number(second)
    );

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  function dateOnlyKey(value) {
    const date = parseDate(value);

    if (!date) {
      return '';
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function formatDateOnly(value) {
    if (!value) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [year, month, day] =
        String(value).split('-');

      return `${day}/${month}/${year}`;
    }

    const date = parseDate(value);

    if (!date) {
      return String(value);
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  function formatDateTime(value) {
    const date = parseDate(value);

    if (!date) {
      return value == null ? '' : String(value);
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function formatCell(value, column) {
    if (isBlank(value)) {
      return '';
    }

    if (
      column === 'Date Created' ||
      column === 'Challan Date' ||
      column === 'Consumed On' ||
      column === 'Scanned At' ||
      column === 'Received At'
    ) {
      return formatDateTime(value);
    }

    return String(value);
  }

  function normalizeRows(rawRows, definition) {
    return rawRows
      .map((rawRow) => {
        const normalizedRow = {};

        Object.entries(rawRow).forEach(
          ([header, value]) => {
            normalizedRow[
              canonicalHeader(header, definition)
            ] = value;
          }
        );

        return normalizedRow;
      })
      .filter((row) =>
        Object.values(row).some(
          (value) => !isBlank(value)
        )
      );
  }

  function validateColumns(rows, definition) {
    const available = new Set(
      rows.flatMap((row) => Object.keys(row))
    );

    const missing = definition.required.filter(
      (column) => !available.has(column)
    );

    if (missing.length) {
      throw new Error(
        `Required columns are missing: ${missing.join(', ')}`
      );
    }
  }

  function groupRows(rows, definition) {
    const groups = new Map();

    rows.forEach((row) => {
      const book = String(
        row[definition.bookColumn] ?? ''
      ).trim();

      const bav = String(
        row[definition.bavColumn] ?? ''
      ).trim();

      const key = normalizeCode(bav)
        ? `bav|||${normalizeCode(bav)}`
        : `book|||${normalizeText(book)}`;

      if (!groups.has(key)) {
        groups.set(key, {
          book,
          bav,
          rows: [],
          cartons: new Set()
        });
      }

      const group = groups.get(key);

      group.rows.push(row);

      const carton = normalizeCode(
        row[definition.cartonColumn]
      );

      if (carton) {
        group.cartons.add(carton);
      }
    });

    return [...groups.values()].sort(
      (a, b) =>
        a.book.localeCompare(
          b.book,
          undefined,
          {
            sensitivity: 'base',
            numeric: true
          }
        ) ||
        a.bav.localeCompare(
          b.bav,
          undefined,
          {
            sensitivity: 'base',
            numeric: true
          }
        )
    );
  }

  function getNumericMoveNumber(value) {
    const number = Number.parseInt(
      String(value ?? '').replace(/[^\d]/g, ''),
      10
    );

    return Number.isFinite(number)
      ? number
      : null;
  }

  function movementSortValue(row) {
    const moveNumber =
      getNumericMoveNumber(row['Move #']);

    if (moveNumber !== null) {
      return moveNumber;
    }

    return (
      parseDate(row['Scanned At'])?.getTime() ??
      Number.MAX_SAFE_INTEGER
    );
  }

  function movementHasMissingChallan(row) {
    return (
      normalizeText(row.Type) === 'scan out' &&
      isBlank(row['Challan No'])
    );
  }

  function getDistinctChallans(movements) {
    const challanMap = new Map();

    movements.forEach((movement) => {
      const original = String(
        movement['Challan No'] ?? ''
      ).trim();

      if (isBlank(original)) {
        return;
      }

      const normalized = normalizeCode(original);

      if (!challanMap.has(normalized)) {
        challanMap.set(normalized, {
          value: original,
          moves: []
        });
      }

      challanMap
        .get(normalized)
        .moves
        .push(movement.__moveNumber);
    });

    return [...challanMap.values()];
  }

  function buildCartonChallanDisplay(carton) {
    if (!carton.distinctChallans.length) {
      return '';
    }

    if (carton.distinctChallans.length === 1) {
      return carton.distinctChallans[0].value;
    }

    return carton.distinctChallans
      .map((challan) => {
        const moves = [...new Set(challan.moves)]
          .sort((a, b) => a - b)
          .map((move) => `Move ${move}`)
          .join(', ');

        return `${moves}: ${challan.value}`;
      })
      .join(' | ');
  }

  function buildCartonMovementSummary(rows) {
    const cartonMap = new Map();

    rows.forEach((row, originalIndex) => {
      const qrCode = String(
        row['QR Code'] ?? ''
      ).trim();

      const key =
        normalizeCode(qrCode) ||
        `blank-qr-${originalIndex}`;

      if (!cartonMap.has(key)) {
        cartonMap.set(key, {
          qrCode,
          book: String(row['Book Name'] ?? '').trim(),
          bav: String(row['BAV Code'] ?? '').trim(),
          movements: [],
          validationMessages: []
        });
      }

      cartonMap.get(key).movements.push({
        ...row,
        __originalIndex: originalIndex
      });
    });

    const cartons = [...cartonMap.values()];

    cartons.forEach((carton) => {
      carton.movements.sort(
        (a, b) =>
          movementSortValue(a) -
            movementSortValue(b) ||
          a.__originalIndex -
            b.__originalIndex
      );

      const used = new Set();

      carton.movements.forEach((movement) => {
        const moveNumber =
          getNumericMoveNumber(movement['Move #']);

        if (moveNumber !== null) {
          used.add(moveNumber);
        }
      });

      let next = 1;

      carton.movements = carton.movements.map(
        (movement) => {
          let moveNumber =
            getNumericMoveNumber(movement['Move #']);

          if (moveNumber === null) {
            while (used.has(next)) {
              next += 1;
            }

            moveNumber = next;
            used.add(next);
            next += 1;
          }

          return {
            ...movement,
            __moveNumber: moveNumber
          };
        }
      );

      carton.movements.sort(
        (a, b) =>
          a.__moveNumber - b.__moveNumber
      );

      const missingMoves = carton.movements
        .filter(movementHasMissingChallan)
        .map((movement) => movement.__moveNumber);

      carton.hasMissingChallan =
        missingMoves.length > 0;

      if (missingMoves.length) {
        carton.validationMessages.push(
          `Missing Challan No for Scan OUT: ${missingMoves
            .map((move) => `Move ${move}`)
            .join(', ')}`
        );
      }

      carton.distinctChallans =
        getDistinctChallans(carton.movements);

      carton.hasChallanMismatch =
        carton.distinctChallans.length > 1;

      if (carton.hasChallanMismatch) {
        carton.validationMessages.push(
          `Different Challan Nos found: ${carton.distinctChallans
            .map((challan) => challan.value)
            .join(', ')}`
        );
      }

      carton.challanDisplay =
        buildCartonChallanDisplay(carton);

      carton.hasValidationProblem =
        carton.hasMissingChallan ||
        carton.hasChallanMismatch;
    });

    const groupMap = new Map();

    cartons.forEach((carton, index) => {
      const key = normalizeCode(carton.bav)
        ? `bav|||${normalizeCode(carton.bav)}`
        : normalizeText(carton.book)
          ? `book|||${normalizeText(carton.book)}`
          : `unknown|||${index}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          book: carton.book,
          bav: carton.bav,
          cartons: []
        });
      }

      groupMap.get(key).cartons.push(carton);
    });

    const groups = [...groupMap.values()]
      .map((group) => {
        group.cartons.sort((a, b) =>
          a.qrCode.localeCompare(
            b.qrCode,
            undefined,
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
        );

        return group;
      })
      .sort(
        (a, b) =>
          a.book.localeCompare(
            b.book,
            undefined,
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
      );

    return {
      cartons,
      groups,
      maxMoveNumber: cartons.reduce(
        (maximum, carton) =>
          Math.max(
            maximum,
            ...carton.movements.map(
              (movement) =>
                movement.__moveNumber || 0
            )
          ),
        0
      )
    };
  }

  function buildMovementPathHtml(carton) {
    return carton.movements
      .map((movement, index) => {
        const location = isBlank(movement.Location)
          ? 'Unknown Location'
          : String(movement.Location).trim();

        const type = isBlank(movement.Type)
          ? `Move ${movement.__moveNumber}`
          : String(movement.Type).trim();

        const colorNumber =
          getMoveColorIndex(index) + 1;

        const item = `
          <span class="movement-path-item move-color-${colorNumber}">
            ${escapeHtml(location)} {${escapeHtml(type)}}
          </span>
        `;

        return index === carton.movements.length - 1
          ? item
          : `${item}<span class="movement-path-arrow">→</span>`;
      })
      .join(' ');
  }

  function buildMovementPathText(carton) {
    return carton.movements
      .map((movement) => {
        const location = isBlank(movement.Location)
          ? 'Unknown Location'
          : String(movement.Location).trim();

        const type = isBlank(movement.Type)
          ? `Move ${movement.__moveNumber}`
          : String(movement.Type).trim();

        /*
          Use a basic ASCII separator in the AutoTable data.
          The visible PDF arrows are drawn separately.
        */
        return `${location} {${type}}`;
      })
      .join(' -> ');
  }

  async function parseFile(file, reportType) {
    const definition = REPORTS[reportType];

    if (!definition) {
      throw new Error('Choose a valid report type.');
    }

    const extension = file.name
      .split('.')
      .pop()
      .toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(extension)) {
      throw new Error(
        'Only CSV, XLSX, and XLS files are supported.'
      );
    }

    const workbook = XLSX.read(
      await file.arrayBuffer(),
      {
        type: 'array',
        cellDates: true,
        raw: true
      }
    );

    const match = chooseSheet(
      workbook.SheetNames,
      definition.expectedSheet,
      extension === 'csv'
    );

    const rows = normalizeRows(
      XLSX.utils.sheet_to_json(
        workbook.Sheets[match.sheet],
        {
          defval: '',
          raw: true
        }
      ),
      definition
    );

    validateColumns(rows, definition);

    const uniqueDates = [
      ...new Set(
        rows
          .map((row) =>
            dateOnlyKey(row[definition.dateColumn])
          )
          .filter(Boolean)
      )
    ].sort();

    const report = {
      reportType,
      reportLabel: definition.label,
      definition,
      filename: file.name,
      selectedSheet:
        extension === 'csv'
          ? 'CSV file'
          : match.sheet,
      sheetNameWasExact: match.exact,
      rows,
      uniqueDates
    };

    if (definition.pivotMovements) {
      const summary =
        buildCartonMovementSummary(rows);

      report.movementCartons = summary.cartons;
      report.movementGroups = summary.groups;
      report.maxMoveNumber = summary.maxMoveNumber;

      report.missingChallanCount =
        summary.cartons.filter(
          (carton) => carton.hasMissingChallan
        ).length;

      report.challanMismatchCount =
        summary.cartons.filter(
          (carton) => carton.hasChallanMismatch
        ).length;
    } else {
      report.groups = groupRows(rows, definition);
    }

    return report;
  }

  function visibleColumns(report) {
    return report.definition.columns.filter(
      (column) =>
        column !== report.definition.dateColumn
    );
  }

  function cartonMovementColumns(report) {
    const columns = [
      'QR Code',
      'Book Name',
      'BAV Code',
      'Carton Count',
      'Movement Path',
      'Challan No'
    ];

    if (
      report.movementCartons.some(
        (carton) => carton.hasValidationProblem
      )
    ) {
      columns.push('Validation');
    }

    return columns;
  }

  function movementCellValue(carton, column) {
    const values = {
      'QR Code': carton.qrCode,
      'Book Name': carton.book,
      'BAV Code': carton.bav,
      'Carton Count': '',
      'Movement Path':
        buildMovementPathText(carton),
      'Challan No': carton.challanDisplay,
      Validation:
        carton.validationMessages.join('; ')
    };

    return values[column] ?? '';
  }

  function renderStandardReport(report) {
    const columns = visibleColumns(report);

    const countColumnIndex =
      columns.indexOf(
        report.definition.countColumn
      );

    const html = report.groups
      .map((group) => {
        const rows = group.rows
          .map((row, rowIndex) => `
            <tr>
              ${columns.map((column) => {
                const value = formatCell(
                  row[column],
                  column
                );

                const classes = [
                  column ===
                    report.definition.bookColumn &&
                  rowIndex === 0
                    ? 'book-cell-first'
                    : '',
                  report.definition
                    .highlightCreatedStatus
                    ? getCreatedCellClass(
                        column,
                        value
                      )
                    : ''
                ]
                  .filter(Boolean)
                  .join(' ');

                return `
                  <td class="${classes}">
                    ${
                      value ||
                      '<span class="empty-cell">—</span>'
                    }
                  </td>
                `;
              }).join('')}
            </tr>
          `)
          .join('');

        return `
          <tbody class="report-group">
            ${rows}
            <tr class="group-count-row">
              ${columns.map((_, index) => `
                <td class="${
                  index === countColumnIndex
                    ? 'group-count'
                    : ''
                }">
                  ${
                    index === countColumnIndex
                      ? group.cartons.size ||
                        group.rows.length
                      : ''
                  }
                </td>
              `).join('')}
            </tr>
          </tbody>
        `;
      })
      .join('');

    return `
      <table>
        <thead>
          <tr>
            ${columns
              .map(
                (column) =>
                  `<th>${escapeHtml(column)}</th>`
              )
              .join('')}
          </tr>
        </thead>
        ${html}
      </table>
    `;
  }

  function renderCartonMovementReport(report) {
    const columns = cartonMovementColumns(report);

    return `
      <table class="movement-report-table">
        <thead>
          <tr>
            ${columns.map(
              (column) =>
                `<th>${escapeHtml(column)}</th>`
            ).join('')}
          </tr>
        </thead>

        ${report.movementGroups.map((group) => `
          <tbody class="report-group">
            ${group.cartons.map(
              (carton, index) => `
                <tr class="${
                  carton.hasValidationProblem
                    ? 'invalid-scanout-row'
                    : ''
                }">
                  ${columns.map((column) => {
                    if (column === 'Movement Path') {
                      return `
                        <td class="movement-path-cell">
                          <div class="movement-path">
                            ${buildMovementPathHtml(carton)}
                          </div>
                        </td>
                      `;
                    }

                    const value =
                      movementCellValue(
                        carton,
                        column
                      );

                    return `
                      <td class="${
                        column === 'Book Name' &&
                        index === 0
                          ? 'book-cell-first'
                          : ''
                      } ${
                        column === 'Validation'
                          ? 'validation-cell'
                          : ''
                      }">
                        ${escapeHtml(value) || '—'}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `
            ).join('')}

            <tr class="group-count-row">
              ${columns.map((column) => `
                <td class="${
                  column === 'Carton Count'
                    ? 'group-count'
                    : ''
                }">
                  ${
                    column === 'Carton Count'
                      ? group.cartons.length
                      : ''
                  }
                </td>
              `).join('')}
            </tr>
          </tbody>
        `).join('')}
      </table>
    `;
  }

  function renderPreview(report) {
    $('#previewSection').classList.remove(
      'hidden'
    );

    $('#previewTitle').textContent =
      `${report.reportLabel} Report`;

    $('#previewMeta').textContent =
      `${report.filename} · Source: ${report.selectedSheet}`;

    $('#reportDate').textContent =
      report.uniqueDates.length === 1
        ? `Date: ${formatDateOnly(
            report.uniqueDates[0]
          )}`
        : '';

    $('#reportPanel').innerHTML =
      report.definition.pivotMovements
        ? renderCartonMovementReport(report)
        : renderStandardReport(report);
  }

  function addPdfHeader(pdf, report) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);

    pdf.text(
      `${report.reportLabel} Report`,
      40,
      33
    );

    if (report.uniqueDates.length === 1) {
      pdf.setFontSize(9);

      pdf.text(
        `Date: ${formatDateOnly(
          report.uniqueDates[0]
        )}`,
        40,
        49
      );

      return 62;
    }

    return 50;
  }

  function drawVectorArrow(
    pdf,
    startX,
    centerY,
    arrowWidth = 16
  ) {
    const endX =
      startX + arrowWidth;

    const headSize = 3.5;

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.8);

    /*
      Main horizontal line.
    */
    pdf.line(
      startX,
      centerY,
      endX,
      centerY
    );

    /*
      Upper arrowhead.
    */
    pdf.line(
      endX,
      centerY,
      endX - headSize,
      centerY - headSize
    );

    /*
      Lower arrowhead.
    */
    pdf.line(
      endX,
      centerY,
      endX - headSize,
      centerY + headSize
    );
  }

  function drawColoredMovementPath(
    pdf,
    cell,
    carton
  ) {
    const paddingX = 5;
    const paddingTop = 9;

    const startX =
      cell.x + paddingX;

    const maximumX =
      cell.x +
      cell.width -
      paddingX;

    const fontSize = 6.8;
    const lineHeight = 10;
    const arrowWidth = 18;
    const gap = 4;

    let cursorX = startX;
    let cursorY =
      cell.y + paddingTop;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(fontSize);

    carton.movements.forEach(
      (movement, index) => {
        const location = isBlank(
          movement.Location
        )
          ? 'Unknown Location'
          : String(movement.Location).trim();

        const type = isBlank(movement.Type)
          ? `Move ${movement.__moveNumber}`
          : String(movement.Type).trim();

        const text =
          `${location} {${type}}`;

        const textWidth =
          pdf.getTextWidth(text);

        const needsArrow =
          index <
          carton.movements.length - 1;

        const totalWidth =
          textWidth +
          (needsArrow
            ? gap + arrowWidth + gap
            : 0);

        /*
          Wrap before drawing when the next movement
          does not fit in the Movement Path cell.
        */
        if (
          cursorX !== startX &&
          cursorX + totalWidth > maximumX
        ) {
          cursorX = startX;
          cursorY += lineHeight;
        }

        const color =
          PDF_MOVE_TEXT_COLORS[
            getMoveColorIndex(index)
          ];

        pdf.setTextColor(
          color[0],
          color[1],
          color[2]
        );

        pdf.text(
          text,
          cursorX,
          cursorY
        );

        cursorX += textWidth;

        if (needsArrow) {
          cursorX += gap;

          drawVectorArrow(
            pdf,
            cursorX,
            cursorY - 2,
            arrowWidth
          );

          cursorX +=
            arrowWidth + gap;
        }
      }
    );

    pdf.setTextColor(0, 0, 0);
  }

  function drawGroupBorders(
    pdf,
    data,
    rowMeta,
    columns
  ) {
    if (data.section !== 'body') {
      return;
    }

    const meta =
      rowMeta[data.row.index];

    if (!meta) {
      return;
    }

    const x = data.cell.x;
    const y = data.cell.y;
    const width = data.cell.width;
    const height = data.cell.height;

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.9);

    if (
      meta.type === 'detail' &&
      meta.isFirst
    ) {
      pdf.line(x, y, x + width, y);
    }

    if (meta.type === 'count') {
      pdf.line(
        x,
        y + height,
        x + width,
        y + height
      );
    }

    if (data.column.index === 0) {
      pdf.line(x, y, x, y + height);
    }

    if (
      data.column.index ===
      columns.length - 1
    ) {
      pdf.line(
        x + width,
        y,
        x + width,
        y + height
      );
    }
  }

  function downloadCartonMovementPdf(report) {
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a3'
    });

    const columns =
      cartonMovementColumns(report);

    const movementPathColumnIndex =
      columns.indexOf('Movement Path');

    const countColumnIndex =
      columns.indexOf('Carton Count');

    const body = [];
    const rowMeta = [];

    report.movementGroups.forEach(
      (group, groupIndex) => {
        group.cartons.forEach(
          (carton, cartonIndex) => {
            body.push(
              columns.map((column) =>
                column === 'Movement Path'
                  ? ''
                  : movementCellValue(
                      carton,
                      column
                    )
              )
            );

            rowMeta.push({
              type: 'detail',
              groupIndex,
              isFirst: cartonIndex === 0,
              carton,
              invalid:
                carton.hasValidationProblem
            });
          }
        );

        body.push(
          columns.map((column) =>
            column === 'Carton Count'
              ? String(group.cartons.length)
              : ''
          )
        );

        rowMeta.push({
          type: 'count',
          groupIndex,
          isFirst: false,
          carton: null
        });
      }
    );

    pdf.autoTable({
      startY: addPdfHeader(pdf, report),
      head: [columns],
      body,
      theme: 'grid',

      margin: {
        left: 18,
        right: 18,
        bottom: 24
      },

      styles: {
        font: 'helvetica',
        fontStyle: 'normal',
        fontSize: 7,
        cellPadding: 3,
        lineWidth: 0.22,
        lineColor: [195, 195, 195],
        textColor: [0, 0, 0],
        overflow: 'linebreak',
        valign: 'middle',
        minCellHeight: 25
      },

      headStyles: {
        fillColor: PDF_HEADER_PEACH,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        lineColor: [0, 0, 0],
        lineWidth: 0.8
      },

      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 115 },
        2: { cellWidth: 90 },
        3: { cellWidth: 55 },
        4: { cellWidth: 455 },
        5: { cellWidth: 125 },
        6: { cellWidth: 150 }
      },

      didParseCell(data) {
        if (data.section !== 'body') {
          return;
        }

        const meta =
          rowMeta[data.row.index];

        if (!meta) {
          return;
        }

        if (
          meta.type === 'detail' &&
          data.column.index ===
            movementPathColumnIndex
        ) {
          data.cell.text = [];

          const estimatedLines = Math.max(
            1,
            Math.ceil(
              meta.carton.movements.length / 3
            )
          );

          data.cell.styles.minCellHeight =
            14 + estimatedLines * 11;
        }

        if (
          meta.type === 'detail' &&
          meta.invalid
        ) {
          data.cell.styles.fillColor =
            [255, 224, 224];
        }

        if (meta.type === 'count') {
          data.cell.styles.fillColor =
            data.column.index ===
            countColumnIndex
              ? [228, 243, 218]
              : [255, 255, 255];

          if (
            data.column.index ===
            countColumnIndex
          ) {
            data.cell.styles.fontStyle =
              'bold';

            data.cell.styles.halign =
              'center';
          }
        }
      },

      didDrawCell(data) {
        const meta =
          data.section === 'body'
            ? rowMeta[data.row.index]
            : null;

        if (
          meta?.type === 'detail' &&
          data.column.index ===
            movementPathColumnIndex
        ) {
          drawColoredMovementPath(
            pdf,
            data.cell,
            meta.carton
          );
        }

        drawGroupBorders(
          pdf,
          data,
          rowMeta,
          columns
        );
      }
    });

    pdf.save(
      'Carton_Movements_Report.pdf'
    );
  }

  function downloadStandardPdf(report) {
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    const columns =
      visibleColumns(report);

    const countColumnIndex =
      columns.indexOf(
        report.definition.countColumn
      );

    const body = [];
    const rowMeta = [];

    report.groups.forEach(
      (group, groupIndex) => {
        group.rows.forEach(
          (row, rowIndex) => {
            body.push(
              columns.map(
                (column) =>
                  formatCell(
                    row[column],
                    column
                  ) || ''
              )
            );

            rowMeta.push({
              type: 'detail',
              groupIndex,
              isFirst: rowIndex === 0,
              row
            });
          }
        );

        body.push(
          columns.map((_, index) =>
            index === countColumnIndex
              ? String(
                  group.cartons.size ||
                  group.rows.length
                )
              : ''
          )
        );

        rowMeta.push({
          type: 'count',
          groupIndex
        });
      }
    );

    pdf.autoTable({
      startY: addPdfHeader(pdf, report),
      head: [columns],
      body,
      theme: 'grid',

      styles: {
        font: 'helvetica',
        fontSize:
          columns.length >= 10
            ? 6.2
            : 7.2,
        lineColor: [190, 190, 190],
        lineWidth: 0.25,
        cellPadding: 2.3
      },

      headStyles: {
        fillColor: PDF_HEADER_PEACH,
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center'
      },

      didParseCell(data) {
        if (data.section !== 'body') {
          return;
        }

        const meta =
          rowMeta[data.row.index];

        if (!meta) {
          return;
        }

        if (
          meta.type === 'detail' &&
          report.definition
            .highlightCreatedStatus
        ) {
          const column =
            columns[data.column.index];

          const color = getCreatedPdfColor(
            column,
            meta.row?.[column]
          );

          if (color) {
            data.cell.styles.fillColor = color;
          }
        }

        if (meta.type === 'count') {
          data.cell.styles.fillColor =
            data.column.index ===
            countColumnIndex
              ? [228, 243, 218]
              : [255, 255, 255];
        }
      },

      didDrawCell(data) {
        drawGroupBorders(
          pdf,
          data,
          rowMeta,
          columns
        );
      }
    });

    pdf.save(
      `${report.reportLabel.replace(
        /[^a-z0-9]+/gi,
        '_'
      )}_Report.pdf`
    );
  }

  function downloadPdf() {
    if (!state.report) {
      return;
    }

    if (
      state.report.definition.pivotMovements
    ) {
      downloadCartonMovementPdf(
        state.report
      );
    } else {
      downloadStandardPdf(state.report);
    }
  }

  $('#uploadForm').addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const file =
        $('#fileInput').files[0];

      const reportType =
        $('#reportType').value;

      const submitButton =
        event.submitter;

      if (!file || !reportType) {
        $('#message').innerHTML =
          '<div class="error">Choose a report type and a file.</div>';

        return;
      }

      try {
        submitButton.disabled = true;
        submitButton.textContent =
          'Reading file…';

        state.unknownStatusClasses.clear();

        state.report = await parseFile(
          file,
          reportType
        );

        renderPreview(state.report);
      } catch (error) {
        $('#message').innerHTML = `
          <div class="error">
            ${escapeHtml(error.message)}
          </div>
        `;
      } finally {
        submitButton.disabled = false;
        submitButton.textContent =
          'Validate & Preview';
      }
    }
  );

  $('#pdfBtn').addEventListener(
    'click',
    downloadPdf
  );

  $('#printBtn').addEventListener(
    'click',
    () => window.print()
  );
})();