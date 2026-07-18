(() => {
    "use strict";
    const $ = selector => document.querySelector(selector), state = {
        report: null,
        unknownStatusClasses: new Map
    }, REPORTS = {
        cartons_consumed: {
            label: "Cartons Consumed",
            expectedSheet: "Cartons Consumed",
            required: [ "QR Code", "Book Title", "BAV Code", "Qty", "Consumed On", "Consumed By", "Last Location" ],
            aliases: {
                "Book Name": "Book Title",
                Quantity: "Qty",
                "Consumed Date": "Consumed On",
                User: "Consumed By"
            },
            columns: [ "QR Code", "Book Title", "BAV Code", "Qty", "Consumed By", "Consumed On", "Last Location" ],
            dateColumn: "Consumed On",
            bookColumn: "Book Title",
            bavColumn: "BAV Code",
            cartonColumn: "QR Code",
            countColumn: "Qty"
        },
        cartons_created: {
            label: "Cartons Created",
            expectedSheet: "Cartons Created",
            required: [ "Date Created", "QR Code", "Book Name", "BAV Code", "Qty per Carton", "Initial Location", "Created By", "Status", "Current Location" ],
            aliases: {
                "Book Title": "Book Name",
                "Quantity per Carton": "Qty per Carton"
            },
            columns: [ "Date Created", "QR Code", "Book Name", "BAV Code", "Edition", "Impression", "Qty per Carton", "Initial Location", "Created By", "Status", "Current Location", "Audited" ],
            dateColumn: "Date Created",
            bookColumn: "Book Name",
            bavColumn: "BAV Code",
            cartonColumn: "QR Code",
            countColumn: "Qty per Carton",
            highlightCreatedStatus: !0
        },
        challan_movement: {
            label: "Challan Movement",
            expectedSheet: "Challan Movement",
            required: [ "Challan No", "Challan Date", "From", "To", "Created By", "Carton No", "Book Name", "BAV Code", "Qty", "Status" ],
            aliases: {
                "Challan Number": "Challan No",
                "Carton Number": "Carton No",
                "Book Title": "Book Name"
            },
            columns: [ "Challan No", "Challan Date", "From", "To", "Created By", "Carton No", "Book Name", "BAV Code", "Qty", "Status", "Received By" ],
            dateColumn: "Challan Date",
            bookColumn: "Book Name",
            bavColumn: "BAV Code",
            cartonColumn: "Carton No",
            countColumn: "Qty"
        },
        carton_movements: {
            label: "Carton Movements",
            expectedSheet: "Carton Movements",
            required: [ "QR Code", "Book Name", "BAV Code", "Move #", "Type", "Location", "Scanned At", "Scanned By" ],
            aliases: {
                "Book Title": "Book Name",
                "Move No": "Move #",
                "Move Number": "Move #",
                "Movement No": "Move #",
                "Movement Number": "Move #",
                "Challan Number": "Challan No"
            },
            columns: [ "QR Code", "Book Name", "BAV Code", "Move #", "Type", "Location", "Scanned At", "Scanned By", "Challan No" ],
            dateColumn: "Scanned At",
            bookColumn: "Book Name",
            bavColumn: "BAV Code",
            cartonColumn: "QR Code",
            pivotMovements: !0
        }
    }, PDF_HEADER_PEACH = [ 255, 226, 202 ], PDF_AUDITED_YES = [ 221, 242, 218 ], PDF_AUDITED_NO = [ 255, 224, 224 ], PDF_STATUS_ACTIVE = [ 220, 238, 255 ], PDF_STATUS_CONSUMED = [ 255, 229, 191 ], PDF_STATUS_CANCELLED = [ 230, 215, 243 ], PDF_STATUS_EXTRA_COLORS = [ [ 223, 241, 236 ], [ 255, 240, 189 ], [ 220, 223, 247 ], [ 242, 217, 230 ], [ 217, 237, 245 ], [ 232, 224, 207 ] ], PDF_MOVE_TEXT_COLORS = [ [ 23, 63, 112 ], [ 111, 32, 54 ], [ 23, 92, 58 ], [ 91, 52, 119 ], [ 138, 72, 31 ], [ 36, 95, 104 ], [ 109, 82, 32 ], [ 75, 79, 143 ] ];
    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>'"]/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        }[character]));
    }
    function normalizeText(value) {
        return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }
    function isBlank(value) {
        if (null == value) return !0;
        const text = String(value).trim().toLowerCase();
        return [ "", "-", "--", "—", "–", "n/a", "na", "null", "none" ].includes(text);
    }
    function normalizeCode(value) {
        return isBlank(value) ? "" : String(value).toUpperCase().replace(/\s+/g, "").trim();
    }
    function getCartonEndingNumber(value) {
        const match = String(value ?? "").trim().match(/(\d+)\D*$/);
        if (!match) return null;
        const number = Number.parseInt(match[1], 10);
        return Number.isFinite(number) ? number : null;
    }
    function compareCartonCodes(leftValue, rightValue) {
        const left = String(leftValue ?? "").trim(), right = String(rightValue ?? "").trim();
        if (!left && !right) return 0;
        if (!left) return 1;
        if (!right) return -1;
        const leftNumber = getCartonEndingNumber(left), rightNumber = getCartonEndingNumber(right), leftPrefix = left.replace(/\d+\D*$/, "").toUpperCase(), rightPrefix = right.replace(/\d+\D*$/, "").toUpperCase(), prefixComparison = leftPrefix.localeCompare(rightPrefix, void 0, {
            sensitivity: "base",
            numeric: !0
        });
        return 0 !== prefixComparison ? prefixComparison : null !== leftNumber && null !== rightNumber && leftNumber !== rightNumber ? leftNumber - rightNumber : left.localeCompare(right, void 0, {
            sensitivity: "base",
            numeric: !0
        });
    }
    function getUnknownStatusIndex(value) {
        const normalized = normalizeText(value);
        if (!normalized) return 0;
        if (!state.unknownStatusClasses.has(normalized)) {
            const nextIndex = state.unknownStatusClasses.size % PDF_STATUS_EXTRA_COLORS.length;
            state.unknownStatusClasses.set(normalized, nextIndex);
        }
        return state.unknownStatusClasses.get(normalized);
    }
    function getCreatedCellClass(column, value) {
        const normalized = normalizeText(value);
        if ("Audited" === column) {
            if ("yes" === normalized) return "audited-yes";
            if ("no" === normalized) return "audited-no";
        }
        if ("Status" === column) {
            if ("active" === normalized) return "status-active";
            if ("consumed" === normalized) return "status-consumed";
            if ("cancelled" === normalized || "canceled" === normalized) return "status-cancelled";
            if (normalized) return `status-extra-${getUnknownStatusIndex(normalized) + 1}`;
        }
        return "";
    }
    function getMoveColorIndex(index) {
        return index % PDF_MOVE_TEXT_COLORS.length;
    }
    function similarity(a, b) {
        const left = normalizeText(a), right = normalizeText(b);
        return left || right ? 1 - function(a, b) {
            const matrix = Array.from({
                length: a.length + 1
            }, () => Array(b.length + 1).fill(0));
            for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
            for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
            for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            return matrix[a.length][b.length];
        }(left, right) / Math.max(left.length, right.length, 1) : 1;
    }
    function parseDate(value) {
        if (null == value || "" === value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        if ("number" == typeof value && window.XLSX?.SSF) {
            const parts = XLSX.SSF.parse_date_code(value);
            if (parts) return new Date(parts.y, parts.m - 1, parts.d, parts.H, parts.M, Math.floor(parts.S));
        }
        const text = String(value).trim(), normalDate = new Date(text.replace(",", " "));
        if (!Number.isNaN(normalDate.getTime())) return normalDate;
        const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
        if (!match) return null;
        let [, day, month, year, hour = "0", minute = "0", second = "0", meridiem] = match;
        if (year = Number(year), hour = Number(hour), year < 100 && (year += 2e3), meridiem) {
            const upper = meridiem.toUpperCase();
            "PM" === upper && hour < 12 && (hour += 12), "AM" === upper && 12 === hour && (hour = 0);
        }
        const parsed = new Date(year, Number(month) - 1, Number(day), hour, Number(minute), Number(second));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    function dateOnlyKey(value) {
        const date = parseDate(value);
        return date ? [ date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0") ].join("-") : "";
    }
    const DATE_ROW_COLORS = [ [ 255, 249, 196 ], [ 239, 224, 200 ], [ 255, 255, 255 ], [ 255, 226, 232 ], [ 226, 240, 255 ], [ 228, 245, 228 ], [ 239, 230, 255 ], [ 238, 238, 238 ] ], CARTONS_CREATED_SUMMARY_COLUMNS = [ "BAV Code", "Book Name", "Packing Area", "Packing Area Audited", "SOSRC", "SOSRC Audited", "RSSB Shop", "RSSB Shop Audited", "RSSB Godown", "RSSB Godown Audited", "In Transit", "Consumed", "Cancelled" ];
    function hasMultipleDates(report) {
        return report.uniqueDates.length > 1;
    }
    function getDateColorIndex(report, dateKey) {
        const index = report.uniqueDates.indexOf(dateKey);
        return index >= 0 ? index % DATE_ROW_COLORS.length : 0;
    }
    function getDateCssColor(report, dateKey) {
        const color = DATE_ROW_COLORS[getDateColorIndex(report, dateKey)];
        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    }
    function getRowDateKey(row, definition) {
        return dateOnlyKey(row[definition.dateColumn]);
    }
    function formatDateOnly(value) {
        if (!value) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
            const [year, month, day] = String(value).split("-");
            return `${day}/${month}/${year}`;
        }
        const date = parseDate(value);
        return date ? new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(date) : String(value);
    }
    function formatCell(value, column) {
        return isBlank(value) ? "" : "Date Created" === column || "Challan Date" === column || "Consumed On" === column || "Scanned At" === column || "Received At" === column ? function(value) {
            const date = parseDate(value);
            return date ? new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(date) : null == value ? "" : String(value);
        }(value) : String(value);
    }
    function normalizeRows(rawRows, definition) {
        return rawRows.map(rawRow => {
            const normalizedRow = {};
            return Object.entries(rawRow).forEach(([header, value]) => {
                normalizedRow[function(header, definition) {
                    const trimmed = String(header ?? "").trim();
                    if (definition.aliases[trimmed]) return definition.aliases[trimmed];
                    const exactKnown = [ ...definition.required, ...definition.columns, ...Object.keys(definition.aliases) ].find(candidate => normalizeText(candidate) === normalizeText(trimmed));
                    return exactKnown ? definition.aliases[exactKnown] || exactKnown : trimmed;
                }(header, definition)] = value;
            }), normalizedRow;
        }).filter(row => Object.values(row).some(value => !isBlank(value)));
    }
    function getNumericMoveNumber(value) {
        const number = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
        return Number.isFinite(number) ? number : null;
    }
    function movementSortValue(row) {
        const moveNumber = getNumericMoveNumber(row["Move #"]);
        return null !== moveNumber ? moveNumber : parseDate(row["Scanned At"])?.getTime() ?? Number.MAX_SAFE_INTEGER;
    }
    function movementHasMissingChallan(row) {
        return "scan out" === normalizeText(row.Type) && isBlank(row["Challan No"]);
    }
    function buildCartonMovementSummary(rows) {
        const cartonMap = new Map;
        rows.forEach((row, originalIndex) => {
            const qrCode = String(row["QR Code"] ?? "").trim(), key = normalizeCode(qrCode) || `blank-qr-${originalIndex}`;
            cartonMap.has(key) || cartonMap.set(key, {
                qrCode: qrCode,
                book: String(row["Book Name"] ?? "").trim(),
                bav: String(row["BAV Code"] ?? "").trim(),
                movements: [],
                validationMessages: []
            });
            const carton = cartonMap.get(key);
            carton.book || isBlank(row["Book Name"]) || (carton.book = String(row["Book Name"]).trim()), 
            carton.bav || isBlank(row["BAV Code"]) || (carton.bav = String(row["BAV Code"]).trim()), 
            carton.movements.push({
                ...row,
                __originalIndex: originalIndex
            });
        });
        const allCartons = [ ...cartonMap.values() ];
        allCartons.forEach(carton => {
            carton.movements.sort((a, b) => movementSortValue(a) - movementSortValue(b) || a.__originalIndex - b.__originalIndex);
            const usedMoveNumbers = new Set;
            carton.movements.forEach(movement => {
                const moveNumber = getNumericMoveNumber(movement["Move #"]);
                null !== moveNumber && usedMoveNumbers.add(moveNumber);
            });
            let nextMoveNumber = 1;
            carton.movements = carton.movements.map(movement => {
                let moveNumber = getNumericMoveNumber(movement["Move #"]);
                if (null === moveNumber) {
                    for (;usedMoveNumbers.has(nextMoveNumber); ) nextMoveNumber += 1;
                    moveNumber = nextMoveNumber, usedMoveNumbers.add(nextMoveNumber), nextMoveNumber += 1;
                }
                return {
                    ...movement,
                    __moveNumber: moveNumber
                };
            }), carton.movements.sort((a, b) => a.__moveNumber - b.__moveNumber), carton.dateKey = function(carton) {
                const lastMovement = carton.movements[carton.movements.length - 1];
                return dateOnlyKey(lastMovement?.["Scanned At"]);
            }(carton), carton.dateLabel = formatDateOnly(carton.dateKey);
            const missingMoves = carton.movements.filter(movementHasMissingChallan).map(movement => movement.__moveNumber);
            carton.hasMissingChallan = missingMoves.length > 0, missingMoves.length && carton.validationMessages.push(`Missing Challan No for Scan OUT: ${missingMoves.map(move => `Move ${move}`).join(", ")}`), 
            carton.distinctChallans = function(movements) {
                const challanMap = new Map;
                return movements.forEach(movement => {
                    const original = String(movement["Challan No"] ?? "").trim();
                    if (isBlank(original)) return;
                    const normalized = normalizeCode(original);
                    normalized && (challanMap.has(normalized) || challanMap.set(normalized, {
                        value: original,
                        moves: []
                    }), challanMap.get(normalized).moves.push(movement.__moveNumber));
                }), [ ...challanMap.values() ];
            }(carton.movements), carton.hasChallanMismatch = carton.distinctChallans.length > 1, 
            carton.hasChallanMismatch && carton.validationMessages.push(`Different Challan Nos found: ${carton.distinctChallans.map(challan => challan.value).join(", ")}`), 
            carton.challanDisplay = function(carton) {
                return carton.distinctChallans.length ? 1 === carton.distinctChallans.length ? carton.distinctChallans[0].value : carton.distinctChallans.map(challan => `${[ ...new Set(challan.moves) ].sort((a, b) => a - b).map(move => `Move ${move}`).join(", ")}: ${challan.value}`).join(" | ") : "";
            }(carton), carton.hasValidationProblem = carton.hasMissingChallan || carton.hasChallanMismatch;
        });
        const cartons = allCartons.filter(carton => carton.movements.length > 1), groupMap = new Map;
        cartons.forEach((carton, index) => {
            const normalizedBav = normalizeCode(carton.bav), normalizedBook = normalizeText(carton.book), identity = normalizedBav ? `bav|||${normalizedBav}` : normalizedBook ? `book|||${normalizedBook}` : `unknown|||${index}`, key = `${carton.dateKey || "no-date"}|||${identity}`;
            groupMap.has(key) || groupMap.set(key, {
                book: carton.book,
                bav: carton.bav,
                dateKey: carton.dateKey,
                dateLabel: carton.dateLabel,
                cartons: []
            }), groupMap.get(key).cartons.push(carton);
        });
        const groups = [ ...groupMap.values() ].map(group => (group.cartons.sort((leftCarton, rightCarton) => compareCartonCodes(leftCarton.qrCode, rightCarton.qrCode)), 
        group)).sort((a, b) => (a.dateKey || "9999-99-99").localeCompare(b.dateKey || "9999-99-99") || a.book.localeCompare(b.book, void 0, {
            sensitivity: "base",
            numeric: !0
        }) || a.bav.localeCompare(b.bav, void 0, {
            sensitivity: "base",
            numeric: !0
        })), maxMoveNumber = cartons.reduce((maximum, carton) => {
            const cartonMaximum = carton.movements.reduce((currentMaximum, movement) => Math.max(currentMaximum, movement.__moveNumber || 0), 0);
            return Math.max(maximum, cartonMaximum);
        }, 0);
        return {
            cartons: cartons,
            groups: groups,
            maxMoveNumber: maxMoveNumber,
            excludedSingleMovementCount: allCartons.length - cartons.length
        };
    }
    function buildMovementPathText(carton) {
        return carton.movements.map(movement => `${isBlank(movement.Location) ? "Unknown Location" : String(movement.Location).trim()} {${isBlank(movement.Type) ? `Move ${movement.__moveNumber}` : String(movement.Type).trim()}}`).join(" -> ");
    }
    function normalizeSummaryRows(rawRows) {
        return rawRows.map(rawRow => {
            const row = {};
            return Object.entries(rawRow).forEach(([header, value]) => {
                const matchedColumn = CARTONS_CREATED_SUMMARY_COLUMNS.find(column => normalizeText(column) === normalizeText(header));
                matchedColumn && (row[matchedColumn] = value);
            }), row;
        }).filter(row => CARTONS_CREATED_SUMMARY_COLUMNS.some(column => !isBlank(row[column]))).sort((a, b) => String(a["Book Name"] ?? "").localeCompare(String(b["Book Name"] ?? ""), void 0, {
            sensitivity: "base",
            numeric: !0
        }) || String(a["BAV Code"] ?? "").localeCompare(String(b["BAV Code"] ?? ""), void 0, {
            sensitivity: "base",
            numeric: !0
        }));
    }
    function readCartonsCreatedSummary(workbook, mainSheetName, extension) {
        if ("csv" === extension) return {
            sheetName: "",
            rows: []
        };
        const summarySheetName = function(workbook, mainSheetName) {
            const candidates = workbook.SheetNames.filter(name => name !== mainSheetName).map(name => ({
                name: name,
                normalized: normalizeText(name)
            })), exactNames = [ "summary", "order summary", "carton summary", "cartons summary", "created summary" ], exact = candidates.find(candidate => exactNames.includes(candidate.normalized));
            if (exact) return exact.name;
            const fuzzy = candidates.map(candidate => ({
                ...candidate,
                score: Math.max(similarity(candidate.name, "Summary"), similarity(candidate.name, "Order Summary"))
            })).sort((a, b) => b.score - a.score)[0];
            return fuzzy?.score >= .68 ? fuzzy.name : "";
        }(workbook, mainSheetName);
        if (!summarySheetName) return {
            sheetName: "",
            rows: []
        };
        return {
            sheetName: summarySheetName,
            rows: normalizeSummaryRows(XLSX.utils.sheet_to_json(workbook.Sheets[summarySheetName], {
                defval: "",
                raw: !0
            }))
        };
    }
    async function parseFile(file, reportType) {
        const definition = REPORTS[reportType];
        if (!definition) throw new Error("Choose a valid report type.");
        const extension = file.name.split(".").pop().toLowerCase();
        if (![ "csv", "xlsx", "xls" ].includes(extension)) throw new Error("Only CSV, XLSX, and XLS files are supported.");
        const workbook = XLSX.read(await file.arrayBuffer(), {
            type: "array",
            cellDates: !0,
            raw: !0
        });
        if (!workbook.SheetNames.length) throw new Error("The file does not contain a readable worksheet.");
        const match = function(sheetNames, expectedName, isCsv) {
            if (isCsv) return {
                sheet: sheetNames[0],
                exact: !0
            };
            const exact = sheetNames.find(name => normalizeText(name) === normalizeText(expectedName));
            if (exact) return {
                sheet: exact,
                exact: !0
            };
            const ranked = sheetNames.map(sheet => ({
                sheet: sheet,
                score: similarity(sheet, expectedName)
            })).sort((a, b) => b.score - a.score);
            if (ranked[0] && ranked[0].score >= .68) return {
                ...ranked[0],
                exact: !1
            };
            if (1 === sheetNames.length) return {
                sheet: sheetNames[0],
                exact: !1
            };
            throw new Error(`Could not find a worksheet close to “${expectedName}”. Available sheets: ${sheetNames.join(", ")}`);
        }(workbook.SheetNames, definition.expectedSheet, "csv" === extension), rows = normalizeRows(XLSX.utils.sheet_to_json(workbook.Sheets[match.sheet], {
            defval: "",
            raw: !0
        }), definition);
        if (!rows.length) throw new Error(`The selected worksheet “${match.sheet}” is empty.`);
        !function(rows, definition) {
            const available = new Set(rows.flatMap(row => Object.keys(row))), missing = definition.required.filter(column => !available.has(column));
            if (missing.length) throw new Error(`Required columns are missing: ${missing.join(", ")}`);
        }(rows, definition);
        const uniqueDates = [ ...new Set(rows.map(row => dateOnlyKey(row[definition.dateColumn])).filter(Boolean)) ].sort(), report = {
            reportType: reportType,
            reportLabel: definition.label,
            definition: definition,
            filename: file.name,
            selectedSheet: "csv" === extension ? "CSV file" : match.sheet,
            sheetNameWasExact: match.exact,
            rows: rows,
            uniqueDates: uniqueDates
        };
        if ("cartons_created" === reportType) {
            const summary = readCartonsCreatedSummary(workbook, match.sheet, extension);
            report.summarySheetName = summary.sheetName, report.summaryRows = summary.rows;
        }
        if (definition.pivotMovements) {
            const summary = buildCartonMovementSummary(rows);
            report.movementCartons = summary.cartons, report.movementGroups = summary.groups, 
            report.maxMoveNumber = summary.maxMoveNumber, report.excludedSingleMovementCount = summary.excludedSingleMovementCount, 
            report.missingChallanCount = summary.cartons.filter(carton => carton.hasMissingChallan).length, 
            report.challanMismatchCount = summary.cartons.filter(carton => carton.hasChallanMismatch).length;
        } else report.groups = function(rows, definition) {
            const groups = new Map;
            return rows.forEach(row => {
                const book = String(row[definition.bookColumn] ?? "").trim(), bav = String(row[definition.bavColumn] ?? "").trim(), dateKey = getRowDateKey(row, definition), normalizedBav = normalizeCode(bav), normalizedBook = normalizeText(book), key = `${dateKey || "no-date"}|||${normalizedBav ? `bav|||${normalizedBav}` : `book|||${normalizedBook}`}`;
                groups.has(key) || groups.set(key, {
                    book: book,
                    bav: bav,
                    dateKey: dateKey,
                    dateLabel: formatDateOnly(dateKey),
                    rows: [],
                    cartons: new Set
                });
                const group = groups.get(key);
                !group.book && book && (group.book = book), !group.bav && bav && (group.bav = bav), 
                group.rows.push(row);
                const carton = normalizeCode(row[definition.cartonColumn]);
                carton && group.cartons.add(carton);
            }), groups.forEach(group => {
                group.rows.sort((leftRow, rightRow) => compareCartonCodes(leftRow[definition.cartonColumn], rightRow[definition.cartonColumn]));
            }), [ ...groups.values() ].sort((a, b) => (a.dateKey || "9999-99-99").localeCompare(b.dateKey || "9999-99-99") || a.book.localeCompare(b.book, void 0, {
                sensitivity: "base",
                numeric: !0
            }) || a.bav.localeCompare(b.bav, void 0, {
                sensitivity: "base",
                numeric: !0
            }));
        }(rows, definition);
        return report;
    }
    function visibleColumns(report) {
        const columns = report.definition.columns.filter(column => column !== report.definition.dateColumn);
        return hasMultipleDates(report) ? [ "Date", ...columns ] : columns;
    }
    function cartonMovementColumns(report) {
        const columns = [ "QR Code", "Book Name", "BAV Code", "Carton Count", "Movement Path", "Challan No" ];
        return hasMultipleDates(report) && columns.unshift("Date"), report.movementCartons.some(carton => carton.hasValidationProblem) && columns.push("Validation"), 
        columns;
    }
    function movementCellValue(carton, column) {
        return {
            Date: carton.dateLabel,
            "QR Code": carton.qrCode,
            "Book Name": carton.book,
            "BAV Code": carton.bav,
            "Carton Count": "",
            "Movement Path": buildMovementPathText(carton),
            "Challan No": carton.challanDisplay,
            Validation: carton.validationMessages.join("; ")
        }[column] ?? "";
    }
    function standardCellValue(report, row, column) {
        return "Date" === column ? formatDateOnly(getRowDateKey(row, report.definition)) : formatCell(row[column], column);
    }
    function renderCartonMovementReport(report) {
        const columns = cartonMovementColumns(report);
        if (!report.movementGroups.length) return '\n        <div class="error">\n          No cartons have more than one movement.\n        </div>\n      ';
        const groupHtml = report.movementGroups.map(group => `\n          <tbody class="report-group">\n\n            ${group.cartons.map((carton, index) => `\n                <tr class="${carton.hasValidationProblem ? "invalid-scanout-row" : ""}"${hasMultipleDates(report) ? ` style="background-color: ${getDateCssColor(report, carton.dateKey)};"` : ""}>\n\n                  ${columns.map(column => {
            if ("Movement Path" === column) return `\n                          <td class="movement-path-cell">\n                            <div class="movement-path">\n                              ${function(carton) {
                return carton.movements.map((movement, index) => {
                    const location = isBlank(movement.Location) ? "Unknown Location" : String(movement.Location).trim(), type = isBlank(movement.Type) ? `Move ${movement.__moveNumber}` : String(movement.Type).trim(), item = `\n          <span class="movement-path-item move-color-${getMoveColorIndex(index) + 1}">\n            ${escapeHtml(location)}\n            {${escapeHtml(type)}}\n          </span>\n        `;
                    return index === carton.movements.length - 1 ? item : `\n          ${item}\n          <span class="movement-path-arrow">→</span>\n        `;
                }).join(" ");
            }(carton)}\n                            </div>\n                          </td>\n                        `;
            const value = movementCellValue(carton, column);
            return `\n                        <td class="${[ "Book Name" === column && 0 === index ? "book-cell-first" : "", "Validation" === column ? "validation-cell" : "", "" === value ? "empty-cell" : "" ].filter(Boolean).join(" ")}">\n                          ${"" === value ? "—" : escapeHtml(value)}\n                        </td>\n                      `;
        }).join("")}\n                </tr>\n              `).join("")}\n\n            <tr class="group-count-row">\n              ${columns.map(column => `\n                  <td class="${"Carton Count" === column ? "group-count" : ""}">\n                    ${"Carton Count" === column ? group.cartons.length.toLocaleString() : ""}\n                  </td>\n                `).join("")}\n            </tr>\n          </tbody>\n        `).join("");
        return `\n      <table class="movement-report-table">\n        <thead>\n          <tr>\n            ${columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}\n          </tr>\n        </thead>\n\n        ${groupHtml}\n      </table>\n    `;
    }
    function renderPreview(report) {
        $("#previewSection").classList.remove("hidden"), $("#previewTitle").textContent = `${report.reportLabel} Report`;
        let previewMeta = `${report.filename} · Source: ${report.selectedSheet}`;
        report.definition.pivotMovements && (previewMeta += ` · ${report.movementCartons.length} cartons with multiple movements`, 
        report.excludedSingleMovementCount > 0 && (previewMeta += ` · ${report.excludedSingleMovementCount} single-movement carton${1 === report.excludedSingleMovementCount ? "" : "s"} skipped`)), 
        $("#previewMeta").textContent = previewMeta, $("#reportDate").textContent = 1 === report.uniqueDates.length ? `Date: ${formatDateOnly(report.uniqueDates[0])}` : "";
        const warnings = function(report) {
            const warnings = [];
            return "CSV file" === report.selectedSheet || report.sheetNameWasExact || warnings.push(`The worksheet “${report.selectedSheet}” was used because it closely matches “${report.definition.expectedSheet}”.`), 
            report.uniqueDates.length > 1 && warnings.push(`More than one date is present in this file: ${report.uniqueDates.map(formatDateOnly).join(", ")}`), 
            report.definition.pivotMovements && report.missingChallanCount > 0 && warnings.push(`${report.missingChallanCount} carton row${1 === report.missingChallanCount ? "" : "s"} marked red because Scan OUT has no Challan No.`), 
            report.definition.pivotMovements && report.challanMismatchCount > 0 && warnings.push(`${report.challanMismatchCount} carton row${1 === report.challanMismatchCount ? "" : "s"} marked red because the movements contain different Challan Nos.`), 
            warnings;
        }(report);
        $("#warnings").innerHTML = warnings.length ? warnings.map(warning => `\n                <div class="warning">\n                  ⚠ ${escapeHtml(warning)}\n                </div>\n              `).join("") : "", 
        $("#reportPanel").innerHTML = report.definition.pivotMovements ? renderCartonMovementReport(report) : function(report) {
            const columns = visibleColumns(report), countColumnIndex = columns.indexOf(report.definition.countColumn), groupHtml = report.groups.map(group => {
                const rowsHtml = group.rows.map((row, rowIndex) => {
                    const cells = columns.map(column => {
                        const value = standardCellValue(report, row, column);
                        return `\n                        <td class="${[ column === report.definition.bookColumn && 0 === rowIndex ? "book-cell-first" : "", report.definition.highlightCreatedStatus ? getCreatedCellClass(column, value) : "", "" === value ? "empty-cell" : "" ].filter(Boolean).join(" ")}">\n                          ${"" === value ? "—" : escapeHtml(value)}\n                        </td>\n                      `;
                    }).join("");
                    return `\n                  <tr class="detail-row"${hasMultipleDates(report) ? ` style="background-color: ${getDateCssColor(report, getRowDateKey(row, report.definition))};"` : ""}>\n                    ${cells}\n                  </tr>\n                `;
                }).join(""), count = group.cartons.size || group.rows.length;
                return `\n            <tbody class="report-group">\n              ${rowsHtml}\n\n              <tr class="group-count-row">\n                ${columns.map((_, index) => `\n                  <td class="${index === countColumnIndex ? "group-count" : ""}">\n                    ${index === countColumnIndex ? count.toLocaleString() : ""}\n                  </td>\n                `).join("")}\n              </tr>\n            </tbody>\n          `;
            }).join("");
            return `\n      <table>\n        <thead>\n          <tr>\n            ${columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}\n          </tr>\n        </thead>\n\n        ${groupHtml}\n      </table>\n    `;
        }(report), updateSummaryPdfButton(report), window.scrollTo({
            top: $("#previewSection").offsetTop - 20,
            behavior: "smooth"
        });
    }
    function addPdfHeader(pdf, report) {
        return pdf.setFont("helvetica", "bold"), pdf.setFontSize(20), pdf.text(`${report.reportLabel} Report`, 40, 33), 
        1 === report.uniqueDates.length ? (pdf.setFontSize(12), pdf.text(`Date: ${formatDateOnly(report.uniqueDates[0])}`, 40, 49), 
        62) : report.uniqueDates.length > 1 ? (pdf.setFontSize(12), pdf.text(`Dates: ${report.uniqueDates.map(formatDateOnly).join(", ")}`, 40, 49), 
        62) : 50;
    }
    function addPdfPageNumber(pdf) {
        const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFont("helvetica", "normal"), pdf.setFontSize(10), pdf.setTextColor(0, 0, 0), 
        pdf.text(`Page ${pdf.internal.getNumberOfPages()}`, pageWidth - 65, pageHeight - 10);
    }
    function drawGroupBorders(pdf, data, rowMeta, columns) {
        if ("body" !== data.section) return;
        const meta = rowMeta[data.row.index];
        if (!meta) return;
        const x = data.cell.x, y = data.cell.y, width = data.cell.width, height = data.cell.height;
        pdf.setDrawColor(0, 0, 0), pdf.setLineWidth(.45), pdf.line(x, y, x + width, y), 
        pdf.line(x, y + height, x + width, y + height), pdf.line(x, y, x, y + height), pdf.line(x + width, y, x + width, y + height), 
        "detail" === meta.type && meta.isFirst && (pdf.setLineWidth(1.35), pdf.line(x, y, x + width, y)), 
        "count" === meta.type && (pdf.setLineWidth(1.35), pdf.line(x, y + height, x + width, y + height)), 
        0 === data.column.index && (pdf.setLineWidth(1.05), pdf.line(x, y, x, y + height)), 
        data.column.index === columns.length - 1 && (pdf.setLineWidth(1.05), pdf.line(x + width, y, x + width, y + height));
    }
    function standardPdfColumnWidths(report, columns, pageWidth) {
        const widths = {}, profile = {
            cartons_consumed: {
                Date: 72,
                "QR Code": 210,
                "Book Title": 345,
                "BAV Code": 185,
                Qty: 85,
                "Consumed By": 125,
                "Last Location": 145
            },
            cartons_created: {
                Date: 72,
                "QR Code": 155,
                "Book Name": 195,
                "BAV Code": 120,
                Edition: 72,
                Impression: 82,
                "Qty per Carton": 90,
                "Initial Location": 120,
                "Created By": 82,
                Status: 82,
                "Current Location": 130,
                Audited: 75
            },
            challan_movement: {
                Date: 72,
                "Challan No": 138,
                From: 82,
                To: 82,
                "Created By": 64,
                "Carton No": 160,
                "Book Name": 200,
                "BAV Code": 128,
                Qty: 58,
                Status: 78,
                "Received By": 90
            }
        }[report.reportType] || {}, availableWidth = pageWidth - 36, requestedWidths = columns.map(column => profile[column] || 100), scale = availableWidth / requestedWidths.reduce((total, width) => total + width, 0);
        return columns.forEach((column, index) => {
            widths[index] = {
                cellWidth: requestedWidths[index] * scale
            };
        }), widths;
    }
    function standardPdfFontSize(report) {
        return "cartons_consumed" === report.reportType ? hasMultipleDates(report) ? 14.9 : 15.4 : "challan_movement" === report.reportType ? hasMultipleDates(report) ? 12.9 : 13.2 : "cartons_created" === report.reportType && hasMultipleDates(report) ? 12.4 : 11.8;
    }
    function movementPdfColumnWidths(columns, pageWidth) {
        const widths = {}, availableWidth = pageWidth - 18 - 18, preferredFixedWidths = {
            Date: 78,
            "QR Code": 160,
            "Book Name": 195,
            "BAV Code": 128,
            "Carton Count": 88,
            "Challan No": 165,
            Validation: 205
        }, preferredFixedTotal = columns.filter(column => "Movement Path" !== column).reduce((total, column) => total + (preferredFixedWidths[column] || 100), 0), maximumFixedTotal = availableWidth - 430, fixedScale = preferredFixedTotal > maximumFixedTotal ? maximumFixedTotal / preferredFixedTotal : 1;
        let actualFixedTotal = 0;
        columns.forEach((column, index) => {
            if ("Movement Path" === column) return;
            const width = (preferredFixedWidths[column] || 100) * fixedScale;
            widths[index] = {
                cellWidth: width
            }, actualFixedTotal += width;
        });
        const movementPathIndex = columns.indexOf("Movement Path");
        return widths[movementPathIndex] = {
            cellWidth: availableWidth - actualFixedTotal
        }, widths;
    }
    function summaryPdfColumnWidths(pageWidth) {
        const preferred = {
            "BAV Code": 105,
            "Book Name": 170,
            "Packing Area": 78,
            "Packing Area Audited": 92,
            SOSRC: 65,
            "SOSRC Audited": 82,
            "RSSB Shop": 75,
            "RSSB Shop Audited": 92,
            "RSSB Godown": 82,
            "RSSB Godown Audited": 96,
            "In Transit": 70,
            Consumed: 72,
            Cancelled: 72
        }, availableWidth = pageWidth - 48, requested = CARTONS_CREATED_SUMMARY_COLUMNS.map(column => preferred[column] || 75), total = requested.reduce((sum, width) => sum + width, 0), widths = {};
        return requested.forEach((width, index) => {
            widths[index] = {
                cellWidth: width * availableWidth / total
            };
        }), widths;
    }
    function downloadStandardPdf(report) {
        const {jsPDF: jsPDF} = window.jspdf, pdf = new jsPDF({
            orientation: "landscape",
            unit: "pt",
            format: "a3"
        }), pageWidth = pdf.internal.pageSize.getWidth(), columns = visibleColumns(report), countColumnIndex = columns.indexOf(report.definition.countColumn), bookColumnIndex = columns.indexOf(report.definition.bookColumn), body = [], rowMeta = [];
        report.groups.forEach((group, groupIndex) => {
            group.rows.forEach((row, rowIndex) => {
                body.push(columns.map(column => standardCellValue(report, row, column) || "")), 
                rowMeta.push({
                    type: "detail",
                    groupIndex: groupIndex,
                    isFirst: 0 === rowIndex,
                    row: row,
                    dateKey: getRowDateKey(row, report.definition)
                });
            }), body.push(columns.map((_, index) => index === countColumnIndex ? String(group.cartons.size || group.rows.length) : "")), 
            rowMeta.push({
                type: "count",
                groupIndex: groupIndex,
                isFirst: !1,
                row: null
            });
        }), pdf.autoTable({
            startY: addPdfHeader(pdf, report),
            head: [ columns ],
            body: body,
            theme: "grid",
            margin: {
                left: 24,
                right: 24,
                bottom: 24
            },
            styles: {
                font: "helvetica",
                fontStyle: "normal",
                fontSize: standardPdfFontSize(report),
                lineColor: [ 0, 0, 0 ],
                lineWidth: .4,
                cellPadding: {
                    top: 3.4,
                    right: 3,
                    bottom: 3.4,
                    left: 3
                },
                overflow: "linebreak",
                valign: "middle",
                textColor: [ 0, 0, 0 ],
                minCellHeight: 30
            },
            headStyles: {
                fillColor: PDF_HEADER_PEACH,
                textColor: [ 0, 0, 0 ],
                fontStyle: "bold",
                fontSize: standardPdfFontSize(report) + .8,
                halign: "center",
                lineWidth: .8,
                lineColor: [ 0, 0, 0 ]
            },
            columnStyles: standardPdfColumnWidths(report, columns, pageWidth),
            didParseCell(data) {
                if ("body" !== data.section) return;
                const meta = rowMeta[data.row.index];
                if (meta) {
                    if (data.cell.styles.fontStyle = "normal", data.cell.styles.textColor = [ 0, 0, 0 ], 
                    "detail" === meta.type && hasMultipleDates(report) && (data.cell.styles.fillColor = DATE_ROW_COLORS[getDateColorIndex(report, meta.dateKey)]), 
                    "detail" === meta.type && meta.isFirst && data.column.index === bookColumnIndex && (data.cell.styles.fontStyle = "bold"), 
                    "detail" === meta.type && report.definition.highlightCreatedStatus) {
                        const column = columns[data.column.index], color = function(column, value) {
                            const normalized = normalizeText(value);
                            if ("Audited" === column) return "yes" === normalized ? PDF_AUDITED_YES : "no" === normalized ? PDF_AUDITED_NO : null;
                            if ("Status" === column) {
                                if ("active" === normalized) return PDF_STATUS_ACTIVE;
                                if ("consumed" === normalized) return PDF_STATUS_CONSUMED;
                                if ("cancelled" === normalized || "canceled" === normalized) return PDF_STATUS_CANCELLED;
                                if (normalized) return PDF_STATUS_EXTRA_COLORS[getUnknownStatusIndex(normalized)];
                            }
                            return null;
                        }(column, meta.row?.[column]);
                        color && (data.cell.styles.fillColor = color);
                    }
                    "count" === meta.type && (data.cell.styles.fillColor = data.column.index === countColumnIndex ? [ 228, 243, 218 ] : [ 255, 255, 255 ], 
                    data.column.index === countColumnIndex && (data.cell.styles.fontStyle = "bold", 
                    data.cell.styles.halign = "center"));
                }
            },
            didDrawCell(data) {
                drawGroupBorders(pdf, data, rowMeta, columns);
            },
            didDrawPage() {
                addPdfPageNumber(pdf);
            }
        }), pdf.save(`${report.reportLabel.replace(/[^a-z0-9]+/gi, "_")}_Report.pdf`);
    }
    function downloadCartonMovementPdf(report) {
        if (!report.movementCartons.length) return void alert("No cartons have more than one movement, so there is nothing to include in the PDF.");
        const {jsPDF: jsPDF} = window.jspdf, movementPageWidth = function(report) {
            const baseWidth = (report.movementCartons.some(carton => carton.hasValidationProblem) ? 1420 : 1191) + (hasMultipleDates(report) ? 100 : 0), extraMoves = Math.max(0, report.maxMoveNumber - 3);
            return Math.min(2200, baseWidth + 150 * extraMoves);
        }(report), pdf = new jsPDF({
            orientation: "landscape",
            unit: "pt",
            format: [ movementPageWidth, 842 ]
        }), actualMovementPageWidth = pdf.internal.pageSize.getWidth(), columns = cartonMovementColumns(report), movementPathColumnIndex = columns.indexOf("Movement Path"), countColumnIndex = columns.indexOf("Carton Count"), bookColumnIndex = columns.indexOf("Book Name"), validationColumnIndex = columns.indexOf("Validation"), challanColumnIndex = columns.indexOf("Challan No"), body = [], rowMeta = [];
        report.movementGroups.forEach((group, groupIndex) => {
            group.cartons.forEach((carton, cartonIndex) => {
                body.push(columns.map(column => "Movement Path" === column ? "" : movementCellValue(carton, column))), 
                rowMeta.push({
                    type: "detail",
                    groupIndex: groupIndex,
                    isFirst: 0 === cartonIndex,
                    carton: carton,
                    dateKey: carton.dateKey,
                    invalid: carton.hasValidationProblem,
                    challanMismatch: carton.hasChallanMismatch
                });
            }), body.push(columns.map(column => "Carton Count" === column ? String(group.cartons.length) : "")), 
            rowMeta.push({
                type: "count",
                groupIndex: groupIndex,
                isFirst: !1,
                carton: null,
                invalid: !1,
                challanMismatch: !1
            });
        }), pdf.autoTable({
            startY: addPdfHeader(pdf, report),
            head: [ columns ],
            body: body,
            theme: "grid",
            horizontalPageBreak: !1,
            margin: {
                left: 18,
                right: 18,
                bottom: 24
            },
            styles: {
                font: "helvetica",
                fontStyle: "normal",
                fontSize: 12.6,
                cellPadding: {
                    top: 4.4,
                    right: 4,
                    bottom: 4.4,
                    left: 4
                },
                lineWidth: .4,
                lineColor: [ 0, 0, 0 ],
                textColor: [ 0, 0, 0 ],
                overflow: "linebreak",
                valign: "middle",
                minCellHeight: 35
            },
            headStyles: {
                fillColor: PDF_HEADER_PEACH,
                textColor: [ 0, 0, 0 ],
                fontStyle: "bold",
                fontSize: 13.6,
                halign: "center",
                lineWidth: .9,
                lineColor: [ 0, 0, 0 ]
            },
            columnStyles: movementPdfColumnWidths(columns, actualMovementPageWidth),
            didParseCell(data) {
                if ("body" !== data.section) return;
                const meta = rowMeta[data.row.index];
                if (meta) {
                    if (data.cell.styles.textColor = [ 0, 0, 0 ], "detail" === meta.type && hasMultipleDates(report) && (data.cell.styles.fillColor = DATE_ROW_COLORS[getDateColorIndex(report, meta.dateKey)]), 
                    "detail" === meta.type && data.column.index === movementPathColumnIndex) {
                        data.cell.text = [];
                        const movementPathWidth = movementPdfColumnWidths(columns, actualMovementPageWidth)[movementPathColumnIndex].cellWidth, estimatedLines = Math.max(1, Math.ceil(buildMovementPathText(meta.carton).length / Math.max(24, movementPathWidth / 7.4)));
                        data.cell.styles.minCellHeight = Math.max(36, 16 + 18 * estimatedLines);
                    }
                    "detail" === meta.type && meta.invalid && (data.cell.styles.fillColor = [ 255, 224, 224 ], 
                    -1 !== validationColumnIndex && data.column.index === validationColumnIndex && (data.cell.styles.textColor = [ 0, 0, 0 ], 
                    data.cell.styles.fontStyle = "bold"), meta.challanMismatch && data.column.index === challanColumnIndex && (data.cell.styles.textColor = [ 0, 0, 0 ], 
                    data.cell.styles.fontStyle = "bold")), "detail" === meta.type && meta.isFirst && data.column.index === bookColumnIndex && (data.cell.styles.fontStyle = "bold"), 
                    "count" === meta.type && (data.cell.styles.fillColor = data.column.index === countColumnIndex ? [ 228, 243, 218 ] : [ 255, 255, 255 ], 
                    data.column.index === countColumnIndex && (data.cell.styles.fontStyle = "bold", 
                    data.cell.styles.halign = "center"));
                }
            },
            didDrawCell(data) {
                const meta = "body" === data.section ? rowMeta[data.row.index] : null;
                "detail" === meta?.type && data.column.index === movementPathColumnIndex && meta.carton && function(pdf, cell, carton) {
                    const startX = cell.x + 7, maximumX = cell.x + cell.width - 7;
                    let cursorX = startX, cursorY = cell.y + 14;
                    pdf.setFont("helvetica", "bold"), pdf.setFontSize(12.8), carton.movements.forEach((movement, index) => {
                        const text = `${isBlank(movement.Location) ? "Unknown Location" : String(movement.Location).trim()} {${isBlank(movement.Type) ? `Move ${movement.__moveNumber}` : String(movement.Type).trim()}}`, textWidth = pdf.getTextWidth(text), needsArrow = index < carton.movements.length - 1;
                        cursorX !== startX && cursorX + (textWidth + (needsArrow ? 39 : 0)) > maximumX && (cursorX = startX, 
                        cursorY += 18);
                        const color = PDF_MOVE_TEXT_COLORS[getMoveColorIndex(index)];
                        pdf.setTextColor(color[0], color[1], color[2]), pdf.text(text, cursorX, cursorY), 
                        cursorX += textWidth, needsArrow && (cursorX += 7, function(pdf, startX, centerY, arrowWidth = 16) {
                            const endX = startX + arrowWidth;
                            pdf.setDrawColor(0, 0, 0), pdf.setLineWidth(.8), pdf.line(startX, centerY, endX, centerY), 
                            pdf.line(endX, centerY, endX - 3.5, centerY - 3.5), pdf.line(endX, centerY, endX - 3.5, centerY + 3.5);
                        }(pdf, cursorX, cursorY - 3, 25), cursorX += 32);
                    }), pdf.setTextColor(0, 0, 0);
                }(pdf, data.cell, meta.carton), drawGroupBorders(pdf, data, rowMeta, columns);
            },
            didDrawPage() {
                addPdfPageNumber(pdf);
            }
        }), pdf.save("Carton_Movements_Report.pdf");
    }
    function ensureSummaryPdfButton() {
        let button = $("#summaryPdfBtn");
        if (button) return button;
        const pdfButton = $("#pdfBtn");
        return pdfButton ? (button = document.createElement("button"), button.type = "button", 
        button.id = "summaryPdfBtn", button.className = pdfButton.className, button.textContent = "Download Summary PDF", 
        button.style.display = "none", button.style.marginLeft = "10px", pdfButton.insertAdjacentElement("afterend", button), 
        button.addEventListener("click", () => {
            state.report && function(report) {
                if ("cartons_created" !== report.reportType || !report.summaryRows?.length) return void alert("No Summary or Order Summary worksheet was found in this Cartons Created file.");
                const {jsPDF: jsPDF} = window.jspdf, pdf = new jsPDF({
                    orientation: "landscape",
                    unit: "pt",
                    format: "a3"
                });
                pdf.setTextColor(0, 0, 0), pdf.setFont("helvetica", "bold"), pdf.setFontSize(20), 
                pdf.text("Cartons Created Summary", 40, 36), pdf.setFont("helvetica", "normal"), 
                pdf.setFontSize(10.5), pdf.text(`Source: ${report.summarySheetName || "Summary sheet"}`, 40, 54);
                const body = report.summaryRows.map(row => CARTONS_CREATED_SUMMARY_COLUMNS.map(column => isBlank(row[column]) ? "" : String(row[column])));
                pdf.autoTable({
                    startY: 68,
                    head: [ CARTONS_CREATED_SUMMARY_COLUMNS ],
                    body: body,
                    theme: "grid",
                    margin: {
                        left: 24,
                        right: 24,
                        bottom: 24
                    },
                    styles: {
                        font: "helvetica",
                        fontStyle: "normal",
                        fontSize: 10.8,
                        textColor: [ 0, 0, 0 ],
                        lineColor: [ 0, 0, 0 ],
                        lineWidth: .4,
                        cellPadding: {
                            top: 4,
                            right: 3,
                            bottom: 4,
                            left: 3
                        },
                        overflow: "linebreak",
                        valign: "middle",
                        minCellHeight: 28
                    },
                    headStyles: {
                        fillColor: PDF_HEADER_PEACH,
                        textColor: [ 0, 0, 0 ],
                        fontStyle: "bold",
                        fontSize: 11.4,
                        halign: "center",
                        lineColor: [ 0, 0, 0 ],
                        lineWidth: .9
                    },
                    columnStyles: summaryPdfColumnWidths(pdf.internal.pageSize.getWidth()),
                    didDrawPage() {
                        addPdfPageNumber(pdf);
                    }
                }), pdf.save("Cartons_Created_Summary.pdf");
            }(state.report);
        }), button) : null;
    }
    function updateSummaryPdfButton(report) {
        const button = ensureSummaryPdfButton();
        if (!button) return;
        const shouldShow = "cartons_created" === report?.reportType && Array.isArray(report.summaryRows) && report.summaryRows.length > 0;
        button.style.display = shouldShow ? "" : "none", button.disabled = !shouldShow, 
        shouldShow && (button.textContent = "Download Summary PDF", button.title = `Download summary from ${report.summarySheetName || "Summary worksheet"}`);
    }
    $("#uploadForm").addEventListener("submit", async event => {
        event.preventDefault();
        const file = $("#fileInput").files[0], reportType = $("#reportType").value, submitButton = event.submitter;
        if (file && reportType) try {
            submitButton.disabled = !0, submitButton.textContent = "Reading file…", $("#message").innerHTML = "", 
            state.unknownStatusClasses.clear(), state.report = await parseFile(file, reportType), 
            renderPreview(state.report);
        } catch (error) {
            state.report = null, updateSummaryPdfButton(null), $("#previewSection").classList.add("hidden"), 
            $("#message").innerHTML = `\n            <div class="error">\n              ${escapeHtml(error.message || "The file could not be processed.")}\n            </div>\n          `;
        } finally {
            submitButton.disabled = !1, submitButton.textContent = "Validate & Preview";
        } else $("#message").innerHTML = '\n            <div class="error">\n              Choose a report type and a file.\n            </div>\n          ';
    }), ensureSummaryPdfButton(), $("#pdfBtn").addEventListener("click", function() {
        state.report && (state.report.definition.pivotMovements ? downloadCartonMovementPdf(state.report) : downloadStandardPdf(state.report));
    }), $("#printBtn").addEventListener("click", () => window.print());
})();