// What the home page's search row was last set to.
//
// It used to live in the URL, because the controls were links. That made the
// browser remember it for free — press Back from the results and the row was
// as you left it — but it also meant every click refetched the listings
// underneath before anyone had pressed Search.
//
// So the row became a form, and this is the memory the URL used to provide.
// sessionStorage, not localStorage: a search you ran ten minutes ago in this
// tab is worth restoring, one from last Tuesday is not.
export type HomeSearch = {
  location: string;
  listingType: string;
  propertyType: string;
  radius: string;
};

const KEY = "homeSearch";

export const rememberHomeSearch = (search: HomeSearch) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(search));
  } catch {
    // Private mode, or storage full. Losing the memory is a small annoyance;
    // throwing here would break the search itself.
  }
};

// Deliberately NOT cleared on read: Back can be pressed more than once, and
// each time should find the row as it was.
export const recallHomeSearch = (): HomeSearch | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<HomeSearch>;
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    const search = {
      location: text(saved.location),
      listingType: text(saved.listingType),
      propertyType: text(saved.propertyType),
      radius: text(saved.radius),
    };
    // Nothing worth restoring.
    return search.location ||
      search.listingType ||
      search.propertyType ||
      search.radius
      ? search
      : null;
  } catch {
    return null;
  }
};
