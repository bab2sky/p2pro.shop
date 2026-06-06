use bigdecimal::BigDecimal;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Category {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub name: String,
    pub name_en: Option<String>,
    pub slug: String,
    pub icon: Option<String>,
    pub depth: i16,
    pub sort_order: i32,
    pub is_active: bool,
    pub is_digital: bool,
    pub commission_rate: BigDecimal,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryTree {
    pub id: Uuid,
    pub name: String,
    pub name_en: Option<String>,
    pub slug: String,
    pub icon: Option<String>,
    pub depth: i16,
    pub commission_rate: BigDecimal,
    pub is_digital: bool,
    /// FR-06: product count including subcategories
    pub product_count: Option<i64>,
    pub children: Vec<CategoryTree>,
}

#[derive(Debug, Serialize)]
pub struct CategoryBreadcrumb {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub is_digital: bool,
    pub parent: Option<Box<CategoryBreadcrumb>>,
}

impl Category {
    pub fn into_tree(self) -> CategoryTree {
        CategoryTree {
            id: self.id,
            name: self.name,
            name_en: self.name_en,
            slug: self.slug,
            icon: self.icon,
            depth: self.depth,
            commission_rate: self.commission_rate,
            is_digital: self.is_digital,
            product_count: None,
            children: vec![],
        }
    }
}

/// Build tree from flat list of categories
pub fn build_category_tree(categories: Vec<Category>) -> Vec<CategoryTree> {
    use std::collections::HashMap;

    let mut nodes: HashMap<Uuid, CategoryTree> = HashMap::new();
    let mut children_map: HashMap<Option<Uuid>, Vec<Uuid>> = HashMap::new();

    for cat in categories {
        let id = cat.id;
        let parent = cat.parent_id;
        nodes.insert(id, cat.into_tree());
        children_map.entry(parent).or_default().push(id);
    }

    fn build(
        parent_id: Option<Uuid>,
        children_map: &HashMap<Option<Uuid>, Vec<Uuid>>,
        nodes: &mut HashMap<Uuid, CategoryTree>,
    ) -> Vec<CategoryTree> {
        let ids = match children_map.get(&parent_id) {
            Some(ids) => ids.clone(),
            None => return vec![],
        };

        let mut result = Vec::new();
        for id in ids {
            if let Some(mut node) = nodes.remove(&id) {
                node.children = build(Some(id), children_map, nodes);
                result.push(node);
            }
        }
        result
    }

    build(None, &children_map, &mut nodes)
}
