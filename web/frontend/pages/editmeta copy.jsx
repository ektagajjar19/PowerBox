import React, { useEffect, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Page, LegacyCard, Button, Frame, Toast, Spinner, Badge, LegacyStack, Text } from '@shopify/polaris';
import { useAuthenticatedFetch } from "../hooks";

export default function EditMeta() {
    const fetch = useAuthenticatedFetch();
    const [productId, setProductId] = useState('');
    const [productName, setProductName] = useState('');
    let [formattedProductName, setformattedProductName] = useState('');
    const [tables, setTables] = useState([{ id: 1, handle: 'spec_1', value: '' }]);
    const [selections, setSelections] = useState([{ id: 1, handle: 'selection_1', value: '' }]);
    const [loadingTables, setLoadingTables] = useState(true);
    const [loadingSelections, setLoadingSelections] = useState(true);
    const [showToast, setShowToast] = useState(false);
    const [rawProductId, setrawProductId] = useState('');

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
                formattedProductName = rawProductName.replace(/\+/g, ' ').toLowerCase().replace(/ /g, '_');
                setformattedProductName(formattedProductName);
            }
            console.log(rawProductId);
        }
    }, []);

    useEffect(() => {
        if (productId) {
            // Fetching tables (Specifications)
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
                        setTables([{ id: 1, handle: formattedProductName + '_spec_1', value: '' }]);
                        setLoadingTables(false);
                    }
                    if (data.length != 0) {
                        const fetchedTables = data.map((item, index) => ({
                            id: index + 1,
                            handle: formattedProductName+ '_' + item.handle,
                            value: item.fields.find(field => field.key === 'spec')?.value || ''
                        }));
                        setTables(fetchedTables);
                        setLoadingTables(false);
                    }
                })
                .catch(error => {
                    console.error('Error fetching metaObjects:', error);
                    setLoadingTables(false);
                });

            // Fetching selections
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
                        setSelections([{ id: 1, handle: formattedProductName + '_selection_1', value: '' }]);
                        setLoadingSelections(false);
                    }
                    if (data.length > 0) {
                        const fetchedSelections = data.map((item, index) => ({
                            id: index + 1,
                            handle: formattedProductName+ '_' + item.handle,
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

    const handleSave = async () => {
        const csrfToken = 'metaobjcsrf';

        // Grouping tables and selections by type
        const tableHandles = tables.map(table => table.handle);
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
            handles: tableHandles,
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
            console.error('Error saving metaObjects:', error);
        }
    };

    return (
        <Page title={`Edit/Add Specifications for ${productName}`}>
            <Frame>
                <div style={stickyButtonStyle}>
                    <Button primary onClick={handleSave}>Save Changes</Button>
                </div>
                <LegacyCard sectioned>
                    <LegacyStack vertical spacing="tight">
                        <Text as="h4" variant="headingMd">
                            Product: <Badge status="info">{productName}</Badge>
                        </Text>
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
                                                <Badge status="info">{`Table${table.id}`}</Badge>
                                            </Text>
                                            <LegacyStack>
                                                <Button onClick={() => handleClone('table', table.id)}>Clone</Button>
                                                <Button destructive onClick={() => setTables(prev => prev.filter(t => t.id !== table.id))}>Delete</Button>
                                            </LegacyStack>
                                        </LegacyStack>
                                        <Editor
                                            apiKey='e7dui2srayjzfpvx0qtv1rgy5fc88lcf2btu1gd9h6bh2uc9'
                                            value={table.value}
                                            onEditorChange={(newValue) => handleEditorChange(newValue, 'table', table.id)}
                                            init={{
                                                height: 500,
                                                menubar: false,
                                                plugins: [
                                                    'advlist autolink lists link image',
                                                    'charmap print preview anchor help',
                                                    'searchreplace visualblocks code',
                                                    'insertdatetime media table paste wordcount'
                                                ],
                                                toolbar:
                                                    'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | help'
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
                                                <Badge status="info">{`Selection${selection.id}`}</Badge>
                                            </Text>
                                            <LegacyStack>
                                                <Button onClick={() => handleClone('selection', selection.id)}>Clone</Button>
                                                <Button destructive onClick={() => setSelections(prev => prev.filter(s => s.id !== selection.id))}>Delete</Button>
                                            </LegacyStack>
                                        </LegacyStack>
                                        <Editor
                                            apiKey='e7dui2srayjzfpvx0qtv1rgy5fc88lcf2btu1gd9h6bh2uc9'
                                            value={selection.value}
                                            onEditorChange={(newValue) => handleEditorChange(newValue, 'selection', selection.id)}
                                            init={{
                                                height: 500,
                                                menubar: false,
                                                plugins: [
                                                    'advlist autolink lists link image',
                                                    'charmap print preview anchor help',
                                                    'searchreplace visualblocks code',
                                                    'insertdatetime media table paste wordcount'
                                                ],
                                                toolbar:
                                                    'undo redo | formatselect | bold italic | alignleft aligncenter alignright | bullist numlist outdent indent | help'
                                            }}
                                        />
                                    </LegacyStack>
                                </div>
                            </LegacyCard>
                        ))
                    )}
                </div>
                {showToast && (
                    <Toast content="MetaObjects saved successfully!" onDismiss={() => setShowToast(false)} />
                )}
            </Frame>
        </Page>
    );
}

// Define sticky button style here to make it always visible
const stickyButtonStyle = {
    position: 'fixed',
    top: 0,
    right: 0,
    padding: '10px',
    zIndex: 1000,
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
};
