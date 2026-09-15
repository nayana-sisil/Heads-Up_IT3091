import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder

# --- 1. LOAD & INSPECT DATA ---
print("Loading dataset...")
df = pd.read_csv('data/DataCoSupplyChainDataset.csv', encoding='ISO-8859-1')

print("--- DATA SUMMARY ---")
print(f"Total rows: {len(df)}")
print(f"Unique Orders: {df['Order Id'].nunique()}")
print("\nTarget Label Distribution:")
print(df['Late_delivery_risk'].value_counts())

# --- 2. AGGREGATE TO ORDER LEVEL ---
print("\nAggregating to single Order ID level...")

# Target label per order
targets = df.groupby('Order Id')['Late_delivery_risk'].max().reset_index()

# Sum numerical sales/quantity per order
numerics = df.groupby('Order Id').agg({
    'Sales': 'sum',
    'Benefit per order': 'sum',
    'Order Item Quantity': 'sum',
    'Product Price': 'mean'
}).reset_index()

# Keep order-level category features
categories = df[['Order Id', 'Type', 'Shipping Mode', 'Days for shipment (scheduled)', 
                 'Customer Segment', 'Order Region', 'Category Name']].drop_duplicates(subset=['Order Id'])

# Merge all into one order-level dataset
orders = categories.merge(numerics, on='Order Id').merge(targets, on='Order Id')

# --- 3. BASIC FEATURE CLEANING ---
# Drop ID column (leakage / non-predictive)
X = orders.drop(columns=['Order Id', 'Late_delivery_risk'])
y = orders['Late_delivery_risk']

# Print previews directly in the terminal
print("\nFeatures (X) Preview:")
print(X.head())

print("\nTarget (y) Preview:")
print(y.head())

# Save the outputs to CSV files inside the data/ folder for inspection
orders.to_csv('data/orders_cleaned.csv', index=False)
X.to_csv('data/X_step3.csv', index=False)
y.to_csv('data/y_step3.csv', index=False)

print("\nSuccess! Step 3 outputs saved to 'data/orders_cleaned.csv', 'data/X_step3.csv', and 'data/y_step3.csv'.")