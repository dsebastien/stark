# Usage

The mock class `MockStarkRBACAuthorizationService` can be imported as follows:

```typescript
import { MockStarkRBACAuthorizationService } from "@nationalbankbelgium/stark-rbac/testing";
```

Since the mock class implements the base interface of the service it mocks, you just need to provide the mock in your `TestingModule`:

```typescript
TestBed.configureTestingModule({
    imports: [...],
    declarations: [...],
    providers: [
        ...
        { provide: STARK_RBAC_AUTHORIZATION_SERVICE, useValue: new MockStarkRBACAuthorizationService() },
        ...
    ]
});
```

Then you can just inject the Stark service via the TestBed using its corresponding `InjectionToken`:

```typescript
// this will inject the instantiated mock class
mockRBACAuthorizationService = TetBed.get(STARK_RBAC_AUTHORIZATION_SERVICE);
```

In fact, every method of the base interface is simply mocked
with a [Vitest mock function](https://vitest.dev/api/mock.html) which can then be used in the unit tests to:

- return custom values
- override a method with a custom function
- asserting that they are actually called
- use the other inspection and implementation controls exposed by Vitest mocks.

For example:

```typescript
// returning custom value
mockRBACAuthorizationService.hasRole.mockReturnValue(true);

// overriding a method with a custom function
mockRBACAuthorizationService.hasRole.mockImplementation((someRole) => {
  // some custom logic to return a specific value
});

// asserting that a method was indeed called
expect(mockRBACAuthorizationService.hasAnyRole).toHaveBeenCalledTimes(1);
expect(mockRBACAuthorizationService.hasAnyRole).toHaveBeenCalledWith(someRoles);
```
