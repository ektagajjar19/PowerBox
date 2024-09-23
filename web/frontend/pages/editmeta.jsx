import React, { useEffect, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Page, LegacyCard, Button, Frame, Toast, Spinner, Badge, LegacyStack, Text, Modal,} from '@shopify/polaris';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useAuthenticatedFetch } from "../hooks";

// CSS
import '../assets/css/style.css';

export default function EditMeta() {
    const csrfToken = 'metaobjcsrf';
    const fetch = useAuthenticatedFetch();
    const [productId, setProductId] = useState('');
    const [productIdNum, setProductIdNum] = useState('');
    const [productName, setProductName] = useState('');
    let [formattedProductName, setformattedProductName] = useState('');
    const [tables, setTables] = useState([{ id: 1, handle: 'spec_1', value: '' }]);
    const [selections, setSelections] = useState([{ id: 1, handle: 'selection_1', value: '' }]);
    const [loadingTables, setLoadingTables] = useState(true);
    const [loadingSelections, setLoadingSelections] = useState(true);
    const [showToast, setShowToast] = useState(false);
    const [showCopyToast, setShowCopyToast] = useState(false);
    const [rawProductId, setrawProductId] = useState('');
    const [toastCopyContent, setToastCopyContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [modalActive, setModalActive] = useState(false);
    const [currentType, setCurrentType] = useState('');
    const [currentId, setCurrentId] = useState(null);
    const handleModalChange = (status, id, type) => {
        setCurrentId(id);
        setModalActive(status);
        setCurrentType(type); // Specification or Selection
    };

    useEffect(() => {
        const match = productId.match(/gid:\/\/shopify\/Product\/(\d+)/);
        if (match) {
          setProductIdNum(match[1]);
        }
      }, [productId]);
      console.log(productIdNum);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const rawProductIdParam = urlParams.get('productId');
        if (rawProductIdParam) {
            const decodedProductIdParam = decodeURIComponent(rawProductIdParam);
            const [rawProductId, rawProductName] = decodedProductIdParam.split('?productName=');
            setrawProductId(rawProductId);
            setProductId(rawProductId);
            if (rawProductName) {
                setProductName(rawProductName.replace(/\+/g, ' '));
                formattedProductName = rawProductName.replace(/[^A-Z0-9]+/ig, ' ').toLowerCase().replace(/ /ig, '_');
                setformattedProductName(formattedProductName);
            }
            console.log(rawProductId);
        }
    }, []);

    useEffect(() => {
        if (productId) {
            fetch('/api/fetch-metaobjects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': 'metaobjcsrf',
                },
                body: JSON.stringify({ productId }),
            })
                .then(response => response.json())
                .then(data => {
                    if (data.length === 0) {
                        console.log("data not found");
                        setTables([{ id: 1, handle: formattedProductName + '_'+ productIdNum +'_spec_1', value: '' }]);
                        setLoadingTables(false);
                    }
                    if (data.length != 0) {
                        const fetchedTables = data.map((item, index) => ({
                            id: index + 1,
                            handle: item.handle,
                            // handle: formattedProductName+ '_' + item.handle,
                            value: item.fields.find(field => field.key === 'spec')?.value || ''
                        }));
                        setTables(fetchedTables);
                        setLoadingTables(false);
                    }
                })
                .catch(error => {
                    console.error('Error fetching Product Data:', error);
                    setLoadingTables(false);
                });
            fetch('/api/fetch-selections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': 'metaobjcsrf',
                },
                body: JSON.stringify({ productId }),
            })
                .then(response => response.json())
                .then(data => {
                    if(data.length === 0){
                        setSelections([{ id: 1, handle: formattedProductName + '_'+ productIdNum + '_selection_1', value: '' }]);
                        setLoadingSelections(false);
                    }
                    if (data.length > 0) {
                        const fetchedSelections = data.map((item, index) => ({
                            id: index + 1,
                            handle: item.handle,
                            value: item.fields.find(field => field.key === 'selection')?.value || ''
                        }));
                        setSelections(fetchedSelections);
                        setLoadingSelections(false);
                    }
                })
                .catch(error => {
                    console.error('Error fetching selections:', error);
                    setLoadingSelections(false);
                });
        }
    }, [productId]);

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const parsedData = XLSX.utils.sheet_to_json(sheet);

            const newTables = [];
            const newSelections = [];
            parsedData.forEach((row, index) => {
                if (row.Type === 'Specification') {
                    newTables.push({ id: index + 1, handle: formattedProductName + '_'+ productIdNum +'_spec_' + (index + 1), value: row.Content });
                } else if (row.Type === 'Selection') {
                    newSelections.push({ id: index + 1, handle: formattedProductName +'_'+ productIdNum + '_selection_' + (index + 1), value: row.Content });
                }
            });

            setTables(newTables);
            setSelections(newSelections);
            setLoadingTables(false);
            setLoadingSelections(false);
        };
        reader.readAsArrayBuffer(file);
    };
    const handleSpecificationExcelUpload = (e) => {
        const file = e.target.files[0];
        if (file && currentId !== null) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const parsedData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    let htmlTable = '<table class="custom-table">';
                    parsedData.forEach((row, rowIndex) => {
                        if (rowIndex === 0) {
                            htmlTable += '<thead><tr>';
                            row.forEach((cell) => {
                                htmlTable += `<th class="custom-th">${cell}</th>`;
                            });
                            htmlTable += '</tr></thead><tbody>';
                        } else {
                            htmlTable += '<tr>';
                            row.forEach((cell) => {
                                htmlTable += `<td>${cell}</td>`;
                            });
                            htmlTable += '</tr>';
                        }
                    });
                    htmlTable += '</tbody></table>';

                    setTables(prev => prev.map(t => t.id === currentId ? { ...t, value: htmlTable } : t));
                    handleModalChange(false); // Close modal after file is processed
                } catch (error) {
                    console.error('Error processing file:', error);
                }
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
            };
            reader.readAsArrayBuffer(file);
        } else {
            console.error('No file selected or ID not set');
        }
    };
    const handleSelectionExcelUpload = (e) => {
        const file = e.target.files[0];
        if (file && currentId !== null) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const parsedData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    let htmlTable = '<table class="custom-table">';
                    parsedData.forEach((row, rowIndex) => {
                        if (rowIndex === 0) {
                            htmlTable += '<thead><tr>';
                            row.forEach((cell) => {
                                htmlTable += `<th class="custom-th">${cell}</th>`;
                            });
                            htmlTable += '</tr></thead><tbody>';
                        } else {
                            htmlTable += '<tr>';
                            row.forEach((cell) => {
                                htmlTable += `<td>${cell}</td>`;
                            });
                            htmlTable += '</tr>';
                        }
                    });
                    htmlTable += '</tbody></table>';

                    setSelections(prev => prev.map(s => s.id === currentId ? { ...s, value: htmlTable } : s));
                    handleModalChange(false); // Close modal after file is processed
                } catch (error) {
                    console.error('Error processing file:', error);
                }
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
            };
            reader.readAsArrayBuffer(file);
        } else {
            console.error('No file selected or ID not set');
        }
    };
    const downloadSampleExcel = () => {
        const ws = XLSX.utils.json_to_sheet([
            { Type: "Specification", Content: "<h1>Spec Content</h1>" },
            { Type: "Selection", Content: "<h1>Selection Content</h1>" }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sample");
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'Sample.xlsx');
    };
    const exportToExcel = () => {
        const tableData = tables.map(table => ({
            Type: 'Specification',
            Content: table.value
        }));
        const selectionData = selections.map(selection => ({
            Type: 'Selection',
            Content: selection.value
        }));
        const allData = [...tableData, ...selectionData];
        const ws = XLSX.utils.json_to_sheet(allData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ExportData');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'ExportedData.xlsx');
    };
    const copyToClipboard = (htmlContent) => {
        navigator.clipboard.writeText(htmlContent).then(() => {
            setToastCopyContent('Copied to clipboard');
            setShowCopyToast(true);
        }).catch(() => {
            setToastCopyContent('Failed to copy');
            setShowCopyToast(true);
        });
    };
    const handleEditorChange = (newValue, itemType, itemId) => {
        const updater = (items) => items.map(t => t.id === itemId ? { ...t, value: newValue } : t);
        if (itemType === 'table') {
            setTables(updater(tables));
        } else if (itemType === 'selection') {
            setSelections(updater(selections));
        }
    };
    const handleClone = (itemType, itemId) => {
        const newItem = itemType === 'table' ? tables.find(t => t.id === itemId) : selections.find(t => t.id === itemId);
        if (newItem) {
            const newId = Math.max(...(itemType === 'table' ? tables : selections).map(t => t.id), 0) + 1;
            const newHandle = newItem.handle.replace(/\d+$/, '') + newId; // Increment the number in the handle
            const newItems = itemType === 'table' ? [...tables, { ...newItem, id: newId, handle: newHandle }] : [...selections, { ...newItem, id: newId, handle: newHandle }];

            if (itemType === 'table') {
                setTables(newItems);
            } else {
                setSelections(newItems);
            }
        }
    };
    // Delete handler with confirmation and API call
    const handleDelete = async (itemHandle, type, itemId) => {
        const confirmDelete = window.confirm('Are you sure you want to delete this table?');
        if (!confirmDelete) return;
        try {
        setIsSaving(true);
        const response = await fetch('/api/delete-metaobject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
            },
            body: JSON.stringify({
                handle: itemHandle,
                type,
            }),
        });
        if (response.ok) {
            if(type === 'spec_tables'){
                setTables((prevTables) => prevTables.filter(table => table.id !== itemId));
            }
            if(type === 'selections'){
                setSelections((prevSelection) => prevSelection.filter(selection => selection.id !== itemId));
            }
            setIsSaving(false);
            alert('Product data deleted successfully.');
        } else {
            setIsSaving(false);
            alert('Error deleting Product data. Make sure you saved existing content before delete.');
        }
        } catch (error) {
        console.error('Error deleting Product data:', error);
        alert('An error occurred while deleting the Product data.');
        }
    };
    const handleSave = async () => {
        setIsSaving(true);
        // Grouping tables and selections by type
        const hable = tables.map(table => table.handle);
        const tableFields = tables.map(table => ({
            metafieldkey: 'spec',
            key: 'spec',
            value: table.value
        }));

        const selectionHandles = selections.map(selection => selection.handle);
        const selectionFields = selections.map(selection => ({
            metafieldkey: 'selections',
            key: 'selection',
            value: selection.value
        }));

        // Creating payloads
        const tablePayload = {
            type: 'spec_tables',
            handles: hable,
            pId: rawProductId,
            fields: tableFields
        };

        const selectionPayload = {
            type: 'selections',
            handles: selectionHandles,
            pId: rawProductId,
            fields: selectionFields
        };

        try {
            // Sending two requests, one for spec_tables and one for selections
            const [tableResponse, selectionResponse] = await Promise.all([
                fetch('/api/upsertmetaobj', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify(tablePayload),
                }),
                fetch('/api/upsertmetaobj', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify(selectionPayload),
                })
            ]);

            const [tableResult, selectionResult] = await Promise.all([
                tableResponse.json(),
                selectionResponse.json()
            ]);

            const hasError = !tableResult.success || !selectionResult.success;
            if (hasError) {
                console.error('Some requests failed:', { tableResult, selectionResult });
            } else {
                setShowToast(true);
            }
        } catch (error) {
            console.error('Error saving Product Data:', error);
        }finally {
            setIsSaving(false);
        }
    };

    return (
        <Page title={`Edit/Add Specifications for ${productName}`}>
            <Frame>
                <div className="stickyButtonStyle">
                    <Button primary onClick={handleSave} disabled={isSaving}>Save Changes</Button>
                </div>
                <LegacyCard sectioned>
                    <LegacyStack vertical spacing="tight">
                        <div className="fileuploadStyle">
                            <div>
                                <Text as="h4" variant="headingMd"> Product: <Badge status="info">{productName}</Badge></Text>
                            </div>
                            <LegacyStack>
                                <Button primary url={`https://admin.shopify.com/store/efa7772f-85ae-49f1-bff7-84ac844d26b8/products/${productIdNum}`}>View Product</Button>
                            </LegacyStack>
                        </div>
                    </LegacyStack>
                </LegacyCard>
                <LegacyCard sectioned>
                    <LegacyStack vertical spacing="tight">
                    <Text as="h6" variant="headingMd">Import/Export data</Text>
                    <hr className='hrupload'/>
                        <div className="fileuploadStyle">
                            <div className="input_container">
                                <input className="uploadXls" type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} />
                            </div>
                            <LegacyStack>
                                <Button onClick={exportToExcel} style={{ marginRight: '5px',}}>Export Data</Button>
                                <Button onClick={downloadSampleExcel}>Download Sample Excel</Button>
                            </LegacyStack>
                        </div>
                    </LegacyStack>
                </LegacyCard>
                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                    <Text variant="heading2xl" as="h3">Specifications</Text>
                </div>
                <div className="Specifications">
                    {loadingTables ? (
                        <Spinner size="large" />
                    ) : (
                        tables.map((table) => (
                            <LegacyCard sectioned key={table.id}>
                                <div style={{ paddingTop: '20px', paddingBottom: '5px' }}>
                                    <LegacyStack vertical spacing="tight">
                                        <LegacyStack distribution="equalSpacing">
                                            <Text as="p" fontWeight="bold">
                                                <Badge status="info">{`Specification ${table.id}`}</Badge>
                                            </Text>
                                            <LegacyStack>
                                                <Button onClick={() => copyToClipboard(table.value)}>Copy</Button>
                                                <Button onClick={() => handleClone('table', table.id)}>Clone</Button>
                                                {/* <Button destructive onClick={() => handleDelete( table.handle, 'spec_tables')}>Delete</Button> */}
                                                <Button destructive onClick={() => handleDelete(table.handle, 'spec_tables', table.id)}>Delete</Button>
                                                <Button primary onClick={() => handleModalChange(true, table.id, 'specification')}>Import Data</Button>
                                            </LegacyStack>
                                        </LegacyStack>
                                        <Editor
                                            apiKey='8ilxq38sg0leiya8cfeu8wsby3fnsce054ewi7hyh7lbw4ca'
                                            value={table.value}
                                            onEditorChange={(newValue) => handleEditorChange(newValue, 'table', table.id)}
                                            init={{
                                                height: 500,
                                                menubar: false,
                                                plugins: 'anchor autolink codesample link lists table visualblocks advtable advcode tableofcontents',
                                                toolbar: 'undo redo | bold italic underline strikethrough | align lineheight | checklist numlist bullist | code'
                                            }}
                                        />
                                    </LegacyStack>
                                </div>
                            </LegacyCard>
                        ))
                    )}
                </div>

                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                    <Text variant="heading2xl" as="h3">Selections</Text>
                </div>

                <div className="Selections">
                    {loadingSelections ? (
                        <Spinner size="large" />
                    ) : (
                        selections.map((selection) => (
                            <LegacyCard sectioned key={selection.id}>
                                <div style={{ paddingTop: '20px', paddingBottom: '5px' }}>
                                    <LegacyStack vertical spacing="tight">
                                        <LegacyStack distribution="equalSpacing">
                                            <Text as="p" fontWeight="bold">
                                                <Badge status="info">{`Selection ${selection.id}`}</Badge>
                                            </Text>
                                            <LegacyStack>
                                                <Button onClick={() => copyToClipboard(selection.value)}>Copy</Button>
                                                <Button onClick={() => handleClone('selection', selection.id)}>Clone</Button>
                                                {/* <Button destructive onClick={() => handleDelete(selection.handle, 'selections')}>Delete</Button> */}
                                                <Button destructive onClick={() => handleDelete(selection.handle, 'selections', selection.id)}>Delete</Button>
                                                <Button primary onClick={() => handleModalChange(true, selection.id, 'selection')}>Import Data</Button>
                                            </LegacyStack>
                                        </LegacyStack>
                                        <Editor
                                            apiKey='8ilxq38sg0leiya8cfeu8wsby3fnsce054ewi7hyh7lbw4ca'
                                            value={selection.value}
                                            onEditorChange={(newValue) => handleEditorChange(newValue, 'selection', selection.id)}
                                            init={{
                                                height: 500,
                                                menubar: false,
                                                plugins: 'anchor autolink codesample link lists table visualblocks advtable advcode tableofcontents',
                                                toolbar: 'undo redo | bold italic underline strikethrough | align lineheight | checklist numlist bullist | code'
                                            }}
                                        />
                                    </LegacyStack>
                                </div>
                            </LegacyCard>
                        ))
                    )}
                </div>
                <Modal
                    open={modalActive}
                    onClose={() => handleModalChange(false, null, '')}
                    title="Upload Excel File"
                    primaryAction={{
                        content: 'Upload',
                        onAction: currentType === 'specification' ? handleSpecificationExcelUpload : handleSelectionExcelUpload,
                    }}
                >
                    <Modal.Section>
                        <LegacyStack vertical>
                            <input className="uploadXls" type="file" accept=".xlsx, .xls, .csv" onChange={currentType === 'specification' ? handleSpecificationExcelUpload : handleSelectionExcelUpload} />
                        </LegacyStack>
                    </Modal.Section>
                </Modal>

                {showToast && (
                    <Toast content="Product Data saved successfully!" duration={3000} onDismiss={()=>setShowToast(false)} />
                )}
                {showCopyToast && <Toast content={toastCopyContent} duration={2000} onDismiss={()=>setShowCopyToast(false)} />}
                {isSaving && (
                    <div className="loader-overlay">
                        <div className="loader">
                            <Spinner size="large" />
                        </div>
                    </div>
                )}
            </Frame>
        </Page>
    );
}
