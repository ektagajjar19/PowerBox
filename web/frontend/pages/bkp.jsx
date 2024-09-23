import React, { useEffect, useState, useCallback } from 'react';
import { Page, Card, IndexTable, Text, Pagination, Thumbnail, Autocomplete, Grid, LegacyCard  } from '@shopify/polaris';

export default function ProductIndexTable() {
    const [products, setProducts] = useState([]);
    const [nextPageInfo, setNextPageInfo] = useState(null);
    const [prevPageInfo, setPrevPageInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [queryValue, setQueryValue] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [currentPage, setCurrentPage] = useState(0); // Track the current page number
    const pageSize = 50;
    const mycsrf = 'productsdataCsrf';

    const fetchProducts = (pageInfo = null, query = '', isPrevious = false) => {
        setLoading(true);
        const pageurl = new URL(window.location.href);
        const shopName = pageurl.searchParams.get('shop');
        const url = '/api/productsdata';

        const requestBody = {
            ShopUrl: shopName,
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
            setFilteredProducts(data.products); // Initialize with all products
            setNextPageInfo(data.has_next_page ? data.next_page_info : null);
            setPrevPageInfo(data.has_prev_page ? data.prev_page_info : null);

            // Update the current page number
            setCurrentPage((prevPage) => isPrevious ? prevPage - 1 : prevPage + 1);
        })
        .catch(error => console.error('Error fetching products:', error))
        .finally(() => setLoading(false));
    };
    const updateQueryValue = useCallback((value) => {
        setQueryValue(value);
        if (value === '') {
            setFilteredProducts(products);
        } else {
            setFilteredProducts(products.filter((product) =>
                product.title.toLowerCase().includes(value.toLowerCase())
            ));
        }
    }, [products]);
    useEffect(() => {
        fetchProducts();
    }, []);

    // Function to calculate the starting index for the current page
    const getStartingIndex = () => (currentPage - 1) * pageSize;

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
                        md: ['search search  search pagination'],
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
                                    onChange={updateQueryValue} // Filter as the user types
                                    placeholder="Search products"
                                />
                            }
                        />
                    </Grid.Cell>
                    <Grid.Cell area="pagination">
                        <Pagination
                            hasPrevious={!!prevPageInfo}
                            onPrevious={() => fetchProducts(prevPageInfo, queryValue, true)}  // Pass true for isPrevious
                            hasNext={!!nextPageInfo}
                            onNext={() => fetchProducts(nextPageInfo, queryValue, false)}     // Pass false for isPrevious
                        />
                    </Grid.Cell>
                </Grid>
            </LegacyCard>
            <LegacyCard>
                <IndexTable
                    resourceName={{ singular: 'product', plural: 'products' }}
                    itemCount={filteredProducts.length}
                    // itemCount={products.length}
                    headings={[
                        // { title: 'ID' },
                        // { title: 'Thumbnail' },
                        { title: 'Global ID' },
                        { title: 'Title' },
                    ]}
                    selectable={false}
                    loading={loading}
                >
                    {filteredProducts.map((product, index) => (
                        <IndexTable.Row
                            // id={product.id}
                            key={product.id}
                            position={index}
                        >
                            {/* <IndexTable.Cell>
                                <TextStyle variation="strong">
                                    {getStartingIndex() + index + 1}
                                </TextStyle>
                            </IndexTable.Cell> */}
                            {/* <IndexTable.Cell>
                                {product.imgUrl ? (
                                    <Thumbnail
                                        source={product.imgUrl}
                                        alt={product.title}
                                    />
                                ) : (
                                    <Thumbnail
                                        source="https://via.placeholder.com/150"
                                    />
                                )}
                            </IndexTable.Cell> */}
                            <IndexTable.Cell>
                                <Text as="p" fontWeight="bold">{product.id}</Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                                {product.title}
                            </IndexTable.Cell>
                        </IndexTable.Row>
                    ))}
                </IndexTable>
            </LegacyCard>
            <LegacyCard sectioned>
                <Grid
                    columns={{xs: 1, sm: 4, md: 4, lg: 6, xl: 6}}
                    areas={{
                        xs: ['search', 'pagination'],
                        sm: [
                        'search search search pagination ',
                        'search search search pagination',
                        ],
                        md: ['search search  search pagination'],
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
                                    onChange={updateQueryValue} // Filter as the user types
                                    placeholder="Search products"
                                />
                            }
                        />
                    </Grid.Cell>
                    <Grid.Cell area="pagination">
                        <Pagination
                            hasPrevious={!!prevPageInfo}
                            onPrevious={() => fetchProducts(prevPageInfo, queryValue, true)}  // Pass true for isPrevious
                            hasNext={!!nextPageInfo}
                            onNext={() => fetchProducts(nextPageInfo, queryValue, false)}     // Pass false for isPrevious
                        />
                    </Grid.Cell>
                </Grid>
            </LegacyCard>
        </Page>
    );
}
