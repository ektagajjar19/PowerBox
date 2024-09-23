import React, { useEffect, useState, useCallback } from 'react';
import { Page, IndexTable, Text, Pagination, Autocomplete, Grid, LegacyCard, Thumbnail, Link, Badge } from '@shopify/polaris';
import { useAuthenticatedFetch } from "../hooks";

export default function ProductIndexTable() {
    const fetch =  useAuthenticatedFetch();
    const [products, setProducts] = useState([]);
    const [nextPageInfo, setNextPageInfo] = useState(null);
    const [prevPageInfo, setPrevPageInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [queryValue, setQueryValue] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 40; // Adjust this value as needed
    const mycsrf = 'productsdataCsrf';

    const fetchProducts = (pageInfo = null, query = '', isPrevious = false) => {
        setLoading(true);
        // const pageurl = new URL(window.location.href);
        // const shopName = pageurl.searchParams.get('shop');
        const url = '/api/productsdata';
        const requestBody = {
            page_info: pageInfo ? pageInfo : null,
            page_size: pageSize,
            query: query,
            is_previous: isPrevious,
        };
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': mycsrf,
            },
            body: JSON.stringify(requestBody),
        })
        .then(response => response.json())
        .then(data => {
            setProducts(data.products);
            setNextPageInfo(data.has_next_page ? data.next_page_info : null);
            setPrevPageInfo(data.has_prev_page ? data.prev_page_info : null);
            if (pageInfo === null && !isPrevious) {
                setCurrentPage(1);
            } else if (query) {
                setCurrentPage(1);
            } else {
                setCurrentPage((prevPage) => isPrevious ? prevPage - 1 : prevPage + 1);
            }
        })
        .catch(error => console.error('Error fetching products:', error))
        .finally(() => setLoading(false));
    };

    const handleSearch = useCallback((value) => {
        setQueryValue(value);
        fetchProducts(null, value);
    }, []);

    useEffect(() => {
        fetchProducts();
    }, []);

    return (
        <Page title="Products">
            <LegacyCard sectioned>
                <Grid
                    columns={{xs: 1, sm: 4, md: 4, lg: 6, xl: 6}}
                    areas={{
                        xs: ['search', 'pagination'],
                        sm: [
                        'search search search pagination ',
                        'search search search pagination',
                        ],
                        md: ['search search search pagination'],
                        lg: ['search search search search search pagination'],
                        xl: ['search search search search search pagination'],
                    }}
                >
                    <Grid.Cell area="search">
                        <Autocomplete
                            options={[]}
                            selected={queryValue ? [queryValue] : []}
                            onSelect={() => {}}
                            textField={
                                <Autocomplete.TextField
                                    value={queryValue}
                                    onChange={handleSearch}
                                    placeholder="Search products"
                                />
                            }
                        />
                    </Grid.Cell>
                    <Grid.Cell area="pagination">
                        <Pagination
                            hasPrevious={!!prevPageInfo}
                            onPrevious={() => fetchProducts(prevPageInfo, queryValue, true)}
                            hasNext={!!nextPageInfo}
                            onNext={() => fetchProducts(nextPageInfo, queryValue, false)}
                        />
                    </Grid.Cell>
                </Grid>
            </LegacyCard>
            <LegacyCard>
                <IndexTable
                    resourceName={{ singular: 'product', plural: 'products' }}
                    itemCount={products.length}
                    headings={[
                        { title: 'No.' },
                        { title: 'Name' },
                        { title: 'Product ID' },
                        { title: 'Status' },
                    ]}
                    selectable={false}
                    loading={loading}
                >
                    {products.map((product, index) => (
                        <IndexTable.Row
                            id={product.id.split('/').pop()}
                            key={product.id.split('/').pop()}
                            position={index}
                        >
                            <IndexTable.Cell>
                                <Text as="p">
                                    {(currentPage - 1) * pageSize + index + 1}
                                </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                                <Link monochrome url={`/editmeta?productId=${product.id}?productName=${product.title}`}>
                                    {product.title}
                                </Link>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                                    <Text as="p" fontWeight="bold">{product.id.split('/').pop()}</Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                                <Badge status={
                                    product.status === 'ACTIVE' ? 'success' :
                                    product.status === 'ARCHIVED' ? 'attention' :
                                    product.status === 'DRAFT' ? 'incomplete' : 'default'}
                                    progress={
                                        product.status === 'ACTIVE' ? 'complete' :
                                        product.status === 'ARCHIVED' ? 'partiallyComplete' :
                                        product.status === 'DRAFT' ? 'incomplete' : 'default'
                                }>
                                    {product.status}
                                </Badge>
                            </IndexTable.Cell>
                        </IndexTable.Row>
                    ))}
                </IndexTable>
            </LegacyCard>
        </Page>
    );
}
